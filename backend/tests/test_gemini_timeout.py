import asyncio
import os
import sys
from google import genai
from dotenv import load_dotenv

# Make sure we can load the environment variables from the root folder
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
project_root = os.path.abspath(os.path.join(backend_root, '..'))
load_dotenv(os.path.join(project_root, '.env'))

api_key = os.environ.get("GEMINI_API_KEY")

async def run():
    print("Testing connection with a strict 30-second timeout to force the error out into the open...")
    # Initialize with a strict timeout so it crashes instead of hanging forever
    client = genai.Client(api_key=api_key, http_options={'timeout': 30.0})
    
    file_path = os.path.join(os.path.dirname(__file__), "test_data", "sample_boq.pdf")
    if not os.path.exists(file_path):
        print(f"ERROR: Cannot find {file_path}")
        return

    print(f"Uploading {file_path}...")
    uploaded_file = client.files.upload(file=file_path, config={"mime_type": "application/pdf"})
    
    print("Processing...")
    while uploaded_file.state.name == "PROCESSING":
        await asyncio.sleep(2)
        uploaded_file = client.files.get(name=uploaded_file.name)
        
    print(f"File state: {uploaded_file.state.name}. Attempting generation...")
    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-2.5-flash',
            contents=[uploaded_file, "Summarize this PDF quickly in one sentence."]
        )
        print("Success! Response:")
        print(response.text)
    except Exception as e:
        print(f"\nCaught the exact error: {type(e).__name__} - {str(e)}")
    finally:
        client.files.delete(name=uploaded_file.name)
        print("Test file deleted.")

if __name__ == "__main__":
    asyncio.run(run())
