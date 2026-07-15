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
    ai_client.GEMINI_PRIMARY_MODEL = 'gemini-3.5-flash'
    ai_client.GEMINI_FALLBACK_MODEL = 'gemini-2.5-pro'
    print(f"Primary model set to: {ai_client.GEMINI_PRIMARY_MODEL}")
    print(f"Fallback model set to: {ai_client.GEMINI_FALLBACK_MODEL}")
    # -----------------------------------------

    prompt = "This is a direct test of the AI client from a script. Respond with a simple confirmation, like 'Test successful'."
    
    # 1. Test Primary Model (Flash)
    print("-> Testing Primary Model (Flash)...")
    response = await ai_client.generate_text(prompt, force_pro=False)
    if response and not response.get("error"):
        print("🟢 Primary Model (Flash) Connection Successful!")
        print(f"   Model: {response.get('model')}")
        print(f"   Response: '{response.get('text').strip()}'")
    else:
        print("🔴 Primary Model (Flash) Connection Failed.")
        print(f"   Error: {response.get('error', 'An unknown error occurred.')}")
        
    # 2. Test Fallback Model (Pro)
    print("\n-> Testing Fallback Model (Pro)...")
    response_pro = await ai_client.generate_text(prompt, force_pro=True)
    if response_pro and not response_pro.get("error"):
        print("🟢 Fallback Model (Pro) Connection Successful!")
        print(f"   Model: {response_pro.get('model')}")
        print(f"   Response: '{response_pro.get('text').strip()}'")
    else:
        print("🔴 Fallback Model (Pro) Connection Failed.")
        print(f"   Error: {response_pro.get('error', 'An unknown error occurred.')}")
        
    print("\n--- End of AI Connection Test ---")

if __name__ == "__main__":
    asyncio.run(run_ai_test())
