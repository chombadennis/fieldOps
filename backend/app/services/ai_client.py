import asyncio
import time
import json
import logging
import base64
import os
import httpx
import google.auth
import google.auth.transport.requests
import google.oauth2.service_account

# --- Project Configuration (From settings/.env) ---
from ..core.config import settings
LOCATION = settings.GOOGLE_CLOUD_LOCATION

# Gemini Model Names for Vertex AI (Standard versions for 2026)
GEMINI_PRIMARY_MODEL = 'gemini-3.5-flash'  
GEMINI_FALLBACK_MODEL = 'gemini-2.5-pro'

# --- Configure Logging ---
logger = logging.getLogger(__name__)

# --- Dual-Project Round-Robin Load Balancer ---
_request_counter = 0  # Increments with every API call to alternate projects

_clients = [
    {
        "creds_json": settings.GOOGLE_CREDENTIALS_JSON,
        "project_id": None,      # Populated on first use from JSON
        "credentials": None,
        "token": None,
        "expiry": 0,
    },
    {
        "creds_json": settings.GOOGLE_CREDENTIALS_JSON_2,
        "project_id": None,
        "credentials": None,
        "token": None,
        "expiry": 0,
    },
]

# Per-project semaphores to prevent hammering the same project from multiple parallel tasks
_project_semaphores = [asyncio.Semaphore(1), asyncio.Semaphore(1)]
_last_request_time = [0.0, 0.0] # Track timing to enforce a gap

def _get_client_slot():
    """Returns the next client slot in round-robin order, skipping disabled slots."""
    global _request_counter
    # If second credential is missing, always use slot 0
    if not _clients[1]["creds_json"]:
        return 0
    slot = _request_counter % 2
    _request_counter += 1
    return slot

def get_access_token(slot: int = 0):
    """Fetches and caches an OAuth2 access token for the given project slot."""
    client = _clients[slot]
    now = time.time()
    
    if client["token"] and client["expiry"] > (now + 300):
        return client["token"], client["project_id"]

    try:
        if not client["credentials"]:
            creds_json = client["creds_json"]
            if creds_json:
                info = json.loads(creds_json)
                client["project_id"] = info.get("project_id", settings.GOOGLE_CLOUD_PROJECT_ID)
                client["credentials"] = google.oauth2.service_account.Credentials.from_service_account_info(
                    info, scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
            else:
                client["credentials"], _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
                client["project_id"] = settings.GOOGLE_CLOUD_PROJECT_ID
        
        auth_req = google.auth.transport.requests.Request()
        client["credentials"].refresh(auth_req)
        client["token"] = client["credentials"].token
        client["expiry"] = now + 3000
        return client["token"], client["project_id"]
    except Exception as e:
        logger.error(f"Universal Auth Failure (slot {slot}). Ensure your .env key is valid or run 'gcloud login': {e}")
        return None, None

async def _call_gemini_text(prompt: str, model: str, retries: int = 10):
    """Async call to Vertex AI using native httpx with robust connection handling and round-robin."""
    slot = _get_client_slot()
    
    async with _project_semaphores[slot]:
        # Enforce a small gap between requests on the same project
        now = time.time()
        elapsed = now - _last_request_time[slot]
        if elapsed < 2.0:
            await asyncio.sleep(2.0 - elapsed)
            
        token, project_id = get_access_token(slot)
        if not token: raise ValueError(f"Application Authentication Token is missing (slot {slot}).")
        logger.info(f"[Slot {slot}] Project: {project_id} | Model: {model} (Text)")
        _last_request_time[slot] = time.time()

    # Route dynamically based on location (global uses aiplatform without region prefix)
    if LOCATION == "global":
        url = f"https://aiplatform.googleapis.com/v1/projects/{project_id}/locations/global/publishers/google/models/{model}:generateContent"
    else:
        url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{LOCATION}/publishers/google/models/{model}:generateContent"

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
        delay = 2
        for attempt in range(1, retries + 1):
            try:
                resp = await client.post(url, json=payload, headers=headers)
                
                # Success
                if resp.status_code == 200:
                    data = resp.json()
                    if 'candidates' in data and data['candidates']:
                        return data['candidates'][0]['content']['parts'][0]['text'], f"Google Vertex AI ({model})"
                    raise ValueError(f"No response candidates from Gemini: {data}")
                
                # Handle Rate Limiting (429) - Wait 30s
                if resp.status_code == 429:
                    logger.warning(f"Quota Exceeded (429) on {project_id}. Waiting 30 seconds for reset (Attempt {attempt})...")
                    await asyncio.sleep(30)
                    continue
                
                # Handle Server Overload (500, 503) - Exponential Backoff
                if resp.status_code in [500, 503]:
                    logger.warning(f"AI Busy (Status {resp.status_code}). Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                
                # Fail-fast for non-retryable errors
                resp.raise_for_status()
                
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                logger.error(f"Network issue (Attempt {attempt}): {e}")
                if attempt < retries:
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                raise Exception(f"Failed to connect to AI service after {retries} attempts.")
        raise Exception(f"AI Service Error (Status {resp.status_code}): {resp.text}")

async def _call_gemini_multimodal(prompt: str, model: str, file_path: str, mime_type: str, retries: int = 10):
    """Securely uploads files (PDF/Image) to Vertex AI via httpx with base64 encoding and round-robin."""
    slot = _get_client_slot()
    
    async with _project_semaphores[slot]:
        # Enforce a small gap between requests on the same project
        now = time.time()
        elapsed = now - _last_request_time[slot]
        if elapsed < 2.0:
            await asyncio.sleep(2.0 - elapsed)
            
        token, project_id = get_access_token(slot)
        if not token: raise ValueError(f"Application Authentication Token is missing (slot {slot}).")
        logger.info(f"[Slot {slot}] Project: {project_id} | Model: {model} (Multimodal)")
        _last_request_time[slot] = time.time()

    # Route dynamically based on location
    if LOCATION == "global":
        url = f"https://aiplatform.googleapis.com/v1/projects/{project_id}/locations/global/publishers/google/models/{model}:generateContent"
    else:
        url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{LOCATION}/publishers/google/models/{model}:generateContent"
    
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
        delay = 2
        for attempt in range(1, retries + 1):
            try:
                resp = await client.post(url, json=payload, headers=headers)
                
                # Success
                if resp.status_code == 200:
                    data = resp.json()
                    if 'candidates' in data and data['candidates']:
                        return data['candidates'][0]['content']['parts'][0]['text'], f"Google Vertex Vision ({model})"
                    raise ValueError(f"No response candidates from Gemini: {data}")
                
                # Handle Rate Limiting (429) - Wait 30s
                if resp.status_code == 429:
                    logger.warning(f"Quota Exceeded (429) on {project_id}. Waiting 30 seconds for reset (Attempt {attempt})...")
                    await asyncio.sleep(30)
                    continue
                
                # Handle Server Overload (500, 503) - Exponential Backoff
                if resp.status_code in [500, 503]:
                    logger.warning(f"AI Busy (Status {resp.status_code}). Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                
                # Fail-fast for non-retryable errors
                resp.raise_for_status()
                
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                logger.error(f"Network issue (Attempt {attempt}): {e}")
                if attempt < retries:
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                raise Exception(f"Failed to connect to AI service after {retries} attempts.")
        raise Exception(f"AI Service Error (Status {resp.status_code}): {resp.text}")

async def generate_text(prompt: str, file_path: str = None, mime_type: str = None, force_pro: bool = False) -> dict:
    """Entry point for all text extraction logic with optional Deep Scan (Pro) routing."""
    # Choose routing logic based on 'force_pro' (Fix #5: Confidence Fallback)
    primary = GEMINI_FALLBACK_MODEL if force_pro else GEMINI_PRIMARY_MODEL
    is_fallback_flag = force_pro
    
    if file_path:
        try:
            result, model_name = await _call_gemini_multimodal(prompt, primary, file_path, mime_type)
            return {"text": result, "model": model_name, "is_fallback": is_fallback_flag}
        except Exception as e:
            if not force_pro: # Only fallback if we haven't already
                logger.error(f"Vertex Vision (Flash) failed, auto-retrying with Pro: {e}")
                try:
                    result, model_name = await _call_gemini_multimodal(prompt, GEMINI_FALLBACK_MODEL, file_path, mime_type)
                    return {"text": result, "model": model_name, "is_fallback": True}
                except Exception as e2:
                    return {"error": "All Vertex AI Vision models failed."}
            return {"error": f"Deep Scan failed: {e}"}
    else:
        try:
            result, model_name = await _call_gemini_text(prompt, primary)
            return {"text": result, "model": model_name}
        except Exception as e:
            return {"error": str(e)}
