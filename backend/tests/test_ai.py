import os
import sys
import asyncio
from dotenv import load_dotenv

# We are in backend/tests/. So '..' is backend, and '../..' is root where .env is.
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
project_root = os.path.abspath(os.path.join(backend_root, '..'))

# Insert root so "backend.app..." imports work perfectly
sys.path.insert(0, project_root)
load_dotenv(os.path.join(project_root, '.env'))

from backend.app.services import ai_client
from backend.app.core.config import settings
import logging

# Set up logging so we can see the "Retrying in 90 seconds" messages!
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')

async def run_ai_test():
    """
    Calls the AI client with a simple prompt and prints the response.
    """
    print("--- Running AI Connection Test ---")
    
    if not any([settings.GEMINI_API_KEY, settings.ANTHROPIC_API_KEY, settings.OPENAI_API_KEY, settings.GOOGLE_CLOUD_PROJECT_ID]):
        print("🔴 ERROR: No AI provider (API Key or Google Cloud Project ID) is configured.")
        print("Please check your .env file.")
        return

    # --- Monkeypatching for this test run ---
    # We will force the use of the known-good models to confirm the fix.
    # SWITCHING TO 1.5-FLASH BECAUSE 2.0-FLASH IS AT LIMIT 0
    ai_client.GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash'
    ai_client.GEMINI_FALLBACK_MODEL = 'gemini-2.5-pro'
    print(f"Primary model set to: {ai_client.GEMINI_PRIMARY_MODEL}")
    print(f"Fallback model set to: {ai_client.GEMINI_FALLBACK_MODEL}")
    # -----------------------------------------

    prompt = "This is a direct test of the AI client from a script. Respond with a simple confirmation, like 'Test successful'."
    
    response = await ai_client.generate_text(prompt)

    if response and not response.get("error"):
        print("🟢 AI Test Successful!")
        print(f"   Model Used: {response.get('model')}")
        print(f"   AI Response: '{response.get('text')}'")
    else:
        print("🔴 AI Test Failed.")
        print(f"   Error: {response.get('error', 'An unknown error occurred.')}")
        
    print("--- End of AI Connection Test ---")

if __name__ == "__main__":
    asyncio.run(run_ai_test())
