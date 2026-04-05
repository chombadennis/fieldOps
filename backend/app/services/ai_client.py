import asyncio
import time
import json
import logging
import urllib.request
import urllib.error
import base64
import os
import httpx
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

# --- Global Cache for Performance ---
_ACCESS_TOKEN = None
_TOKEN_EXPIRY = 0
_CREDENTIALS = None

def get_access_token():
    """Fetches and caches an OAuth2 access token to stop network saturation."""
    global _ACCESS_TOKEN, _TOKEN_EXPIRY, _CREDENTIALS
    
    now = time.time()
    if _ACCESS_TOKEN and _TOKEN_EXPIRY > (now + 300):
        return _ACCESS_TOKEN

    try:
        if not _CREDENTIALS:
            if settings.GOOGLE_CREDENTIALS_JSON:
                info = json.loads(settings.GOOGLE_CREDENTIALS_JSON)
                _CREDENTIALS = google.oauth2.service_account.Credentials.from_service_account_info(
                    info, scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
            else:
                _CREDENTIALS, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
        
        auth_req = google.auth.transport.requests.Request()
        _CREDENTIALS.refresh(auth_req)
        
        _ACCESS_TOKEN = _CREDENTIALS.token
        _TOKEN_EXPIRY = now + 3000
        return _ACCESS_TOKEN
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
    """Async call to Vertex AI using native httpx with robust connection handling."""
    token = get_access_token()
    if not token: raise ValueError("Application Authentication Token is missing.")

    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{model}:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Use a high-performance timeout and ensure the client is closed properly
    async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            if 'candidates' in data and data['candidates']:
                return data['candidates'][0]['content']['parts'][0]['text'], f"Google Vertex AI ({model})"
            raise ValueError(f"No response candidates from Gemini: {data}")
        except Exception as e:
            logger.error(f"Vertex AI Text Error: {e}")
            raise

async def _call_gemini_multimodal(prompt: str, model: str, file_path: str, mime_type: str):
    """Securely uploads files (PDF/Image) to Vertex AI via httpx with base64 encoding."""
    token = get_access_token()
    if not token: raise ValueError("Application Authentication Token is missing.")

    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{model}:generateContent"
    
    with open(file_path, "rb") as f:
        file_data = base64.b64encode(f.read()).decode("utf-8")
        
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": file_data}}
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            if 'candidates' in data and data['candidates']:
                return data['candidates'][0]['content']['parts'][0]['text'], f"Google Vertex Vision ({model})"
            raise ValueError(f"No response candidates from Vision: {data}")
        except Exception as e:
            logger.error(f"Vertex AI Vision Error: {e}")
            raise

async def generate_text(prompt: str, file_path: str = None, mime_type: str = None, force_pro: bool = False) -> dict:
    """Entry point for all text extraction logic with optional Deep Scan (Pro) routing."""
    # Choose routing logic based on 'force_pro' (Fix #5: Confidence Fallback)
    primary = GEMINI_FALLBACK_MODEL if force_pro else GEMINI_PRIMARY_MODEL
    is_fallback_flag = force_pro
    
    if file_path:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_gemini_multimodal(prompt, primary, file_path, mime_type))
            return {"text": result, "model": model_name, "is_fallback": is_fallback_flag}
        except Exception as e:
            if not force_pro: # Only fallback if we haven't already
                logger.error(f"Vertex Vision (Flash) failed, auto-retrying with Pro: {e}")
                try:
                    result, model_name = await _generate_with_retry(lambda: _call_gemini_multimodal(prompt, GEMINI_FALLBACK_MODEL, file_path, mime_type))
                    return {"text": result, "model": model_name, "is_fallback": True}
                except Exception as e2:
                    return {"error": "All Vertex AI Vision models failed."}
            return {"error": f"Deep Scan failed: {e}"}
    else:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_gemini_text(prompt, primary))
            return {"text": result, "model": model_name}
        except Exception as e:
            return {"error": str(e)}
