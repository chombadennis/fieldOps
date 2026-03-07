import asyncio
import time
from google import genai
from openai import OpenAI
import anthropic
import logging

from ..core.config import settings

# --- Configure Logging ---
logger = logging.getLogger(__name__)

# --- Initialize AI Clients (Singleton pattern) ---
# This ensures we don't re-initialize clients on every request.

# Google Gemini (using the new google-genai SDK)
gemini_client = None
if settings.GEMINI_API_KEY:
    try:
        # As per the new SDK documentation, we instantiate a client.
        gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Google Gemini client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Google Gemini client: {e}")

# OpenAI
openai_client = None
if settings.OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info("OpenAI client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")

# Anthropic
anthropic_client = None
if settings.ANTHROPIC_API_KEY:
    try:
        anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        logger.info("Anthropic client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Anthropic client: {e}")


# --- Model Names ---
# Standardized model names for clarity
GEMINI_PRIMARY_MODEL = 'gemini-pro-latest'
GEMINI_FALLBACK_MODEL = 'gemini-2.5-pro'
OPENAI_MODEL = 'gpt-3.5-turbo'
ANTHROPIC_MODEL = 'claude-3-sonnet-20240229'

# --- Core Generation Logic with Async Support ---

async def _generate_with_retry(api_call_function, retries=3, initial_delay=2):
    """Helper to retry an async API call with exponential backoff."""
    delay = initial_delay
    for attempt in range(1, retries + 1):
        try:
            return await api_call_function()
        except Exception as e:
            logger.warning(f"API call attempt {attempt} failed: {e}")
            if attempt == retries:
                raise
            logger.info(f"Retrying in {delay} seconds...")
            await asyncio.sleep(delay)  # Non-blocking sleep
            delay *= 2
    raise Exception("API call failed after multiple retries.")

async def _call_gemini(prompt: str, model: str):
    """Async call to a specific Gemini model using the new google-genai SDK."""
    if not gemini_client:
        raise ValueError("Gemini client is not initialized.")
    logger.info(f"Attempting to generate content with Gemini model: {model}")
    # The new SDK uses client.aio.models.generate_content for async calls
    response = await gemini_client.aio.models.generate_content(model=model, contents=prompt)
    return response.text, f"Google Gemini ({model})"

async def _call_anthropic(prompt: str):
    """Async call to the Anthropic API."""
    if not anthropic_client:
        raise ValueError("Anthropic client is not initialized.")
    logger.info(f"Attempting to generate content with Anthropic model: {ANTHROPIC_MODEL}")
    response = anthropic_client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text, f"Anthropic ({ANTHROPIC_MODEL})"

async def _call_openai(prompt: str):
    """Async call to the OpenAI API using the chat completions endpoint."""
    if not openai_client:
        raise ValueError("OpenAI client is not initialized.")
    logger.info(f"Attempting to generate content with OpenAI model: {OPENAI_MODEL}")
    response = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=2000
    )
    return response.choices[0].message.content, f"OpenAI ({OPENAI_MODEL})"


async def generate_text(prompt: str) -> dict:
    """
    Generates text using an async cascade of AI models with fallbacks and retries.
    Order of preference: Gemini -> Anthropic -> OpenAI.
    Returns a dictionary with 'text' and 'model' keys on success.
    """
    # 1. Try Gemini Models (check if the client was initialized)
    if gemini_client:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_gemini(prompt, GEMINI_PRIMARY_MODEL))
            return {"text": result, "model": model_name}
        except Exception as e:
            logger.error(f"Gemini primary model ({GEMINI_PRIMARY_MODEL}) failed definitively: {e}")
            try:
                result, model_name = await _generate_with_retry(lambda: _call_gemini(prompt, GEMINI_FALLBACK_MODEL))
                return {"text": result, "model": model_name}
            except Exception as e2:
                logger.error(f"Gemini fallback model ({GEMINI_FALLBACK_MODEL}) also failed: {e2}")

    # 2. Fallback to Anthropic
    if anthropic_client:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_anthropic(prompt))
            return {"text": result, "model": model_name}
        except Exception as e:
            logger.error(f"Anthropic fallback failed definitively: {e}")

    # 3. Fallback to OpenAI
    if openai_client:
        try:
            result, model_name = await _generate_with_retry(lambda: _call_openai(prompt))
            return {"text": result, "model": model_name}
        except Exception as e:
            logger.error(f"OpenAI fallback failed definitively: {e}")

    # 4. If all services fail
    logger.critical("All AI services failed to generate a response.")
    return {"error": "All AI services failed to generate a response."}
