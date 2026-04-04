import asyncio
import time
import json
import logging
import urllib.request
import urllib.error
import base64
import os
import google.auth
import google.auth.transport.requests
import google.oauth2.service_account

# --- Project Configuration (From settings/.env) ---
from ..core.config import settings
PROJECT_ID = settings.GOOGLE_CLOUD_PROJECT_ID
LOCATION = settings.GOOGLE_CLOUD_LOCATION

# Gemini Model Names for Vertex AI (Standard versions for 2026)
GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash'
GEMINI_FALLBACK_MODEL = 'gemini-2.5-pro'

# --- Configure Logging ---
logger = logging.getLogger(__name__)

def get_access_token():
    """Fetches a fresh OAuth2 access token from either your .env JSON or local gcloud ADC."""
    try:
        # 1. First choice: Use the Key JSON from your .env
        if settings.GOOGLE_CREDENTIALS_JSON:
            try:
                # Pydantic reads it as a string; we need the dict
                info = json.loads(settings.GOOGLE_CREDENTIALS_JSON)
                credentials = google.oauth2.service_account.Credentials.from_service_account_info(
                    info,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                auth_req = google.auth.transport.requests.Request()
                credentials.refresh(auth_req)
                return credentials.token
            except Exception as e:
                logger.error(f"Failed to use credential JSON from .env: {e}")

        # 2. Final Fallback: Use ADC (gcloud login)
        credentials, project = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
        auth_req = google.auth.transport.requests.Request()
        credentials.refresh(auth_req)
        return credentials.token
    except Exception as e:
        logger.error(f"Universal Auth Failure. Ensure your .env key is valid or run 'gcloud login': {e}")
        return None

async def _generate_with_retry(api_call_function, retries=10, initial_delay=2):
    """Helper for retries with exponential backoff."""
    delay = initial_delay
    for attempt in range(1, retries + 1):
        try:
            return await api_call_function()
        except Exception as e:
            error_msg = str(e)
            logger.warning(f"API call attempt {attempt} failed: {error_msg}")
            if attempt == retries: raise
            
            current_delay = 90 if "429" in error_msg else delay
            logger.info(f"Retrying in {current_delay} seconds...")
            await asyncio.sleep(current_delay)
            delay *= 2
    raise Exception("API call failed after multiple retries.")

async def _call_gemini_text(prompt: str, model: str):
    """Async call to Vertex AI using native urllib for IPv4 stability on Windows."""
    token = get_access_token()
    if not token: raise ValueError("Application Authentication Token is missing.")

    logger.info(f"Attempting to generate text content with Vertex AI model: {model}")
    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{model}:generateContent"
    payload = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}]}).encode('utf-8')
    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    req = urllib.request.Request(url, data=payload, headers=headers)
    
    def fetch():
        try:
            with urllib.request.urlopen(req, timeout=180.0) as response:
                data = json.loads(response.read().decode('utf-8'))
                if 'candidates' in data and data['candidates']:
                    return data['candidates'][0]['content']['parts'][0]['text']
                raise ValueError(f"Unexpected response structure: {data}")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            logger.error(f"VERTEX AI ERROR: {err_body}")
            raise Exception(f"Vertex AI Error {e.code}: {err_body}")
            
    result_text = await asyncio.to_thread(fetch)
    return result_text, f"Google Vertex AI ({model})"

async def _call_gemini_multimodal(prompt: str, model: str, file_path: str, mime_type: str):
    """Securely uploads files (PDF/Image) to Vertex AI via base64 inline encoding."""
    token = get_access_token()
    if not token: raise ValueError("Application Authentication Token is missing.")

    logger.info(f"Analyzing {file_path} via Vertex AI using credits...")
    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{model}:generateContent"
    
    with open(file_path, "rb") as f:
        file_data = base64.b64encode(f.read()).decode("utf-8")
        
    payload = json.dumps({
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": file_data}}
            ]
        }]
    }).encode('utf-8')
    
    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    req = urllib.request.Request(url, data=payload, headers=headers)
    
    def fetch():
        try:
            with urllib.request.urlopen(req, timeout=180.0) as response:
                data = json.loads(response.read().decode('utf-8'))
                if 'candidates' in data and data['candidates']:
                    return data['candidates'][0]['content']['parts'][0]['text']
                raise ValueError(f"Unexpected response structure: {data}")
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            logger.error(f"VERTEX AI VISION ERROR: {err_body}")
            raise Exception(f"Vertex AI Error {e.code}: {err_body}")
            
    result_text = await asyncio.to_thread(fetch)
    return result_text, f"Google Vertex Vision ({model})"

async def generate_text(prompt: str, file_path: str = None, mime_type: str = None) -> dict:
    """Entry point for all text extraction logic."""
    if file_path:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_gemini_multimodal(prompt, GEMINI_PRIMARY_MODEL, file_path, mime_type))
            return {"text": result, "model": model_name}
        except Exception as e:
            logger.error(f"Vertex Vision failed: {e}")
            try:
                result, model_name = await _generate_with_retry(lambda: _call_gemini_multimodal(prompt, GEMINI_FALLBACK_MODEL, file_path, mime_type))
                return {"text": result, "model": model_name}
            except Exception as e2:
                return {"error": "All Vertex AI models failed."}
    else:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_gemini_text(prompt, GEMINI_PRIMARY_MODEL))
            return {"text": result, "model": model_name}
        except Exception as e:
            return {"error": str(e)}
