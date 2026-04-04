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

from backend.app.services.ai_extractor import get_ai_extraction
from backend.app.services import ai_client
import tempfile
import logging

logging.basicConfig(level=logging.INFO)

async def run_direct():
    print("Directly testing AI pipeline to catch raw exceptions...")
    pdf_path = os.path.join(os.path.dirname(__file__), "test_data", "sample_boq.pdf")
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: Cannot find {pdf_path}")
        return
        
    with open(pdf_path, 'rb') as f:
        contents = f.read()
        
    fd, temp_pdf_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(contents)
            
        print(f"Temporary file created at: {temp_pdf_path}")
        
        # Test Gemini
        ai_client.GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash'
        ai_client.GEMINI_FALLBACK_MODEL = 'gemini-2.5-pro'
        
        result = await get_ai_extraction(
            text="See the attached visual PDF document.",
            file_path=temp_pdf_path,
            mime_type="application/pdf"
        )
        print("RESULT:")
        print(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)

if __name__ == "__main__":
    asyncio.run(run_direct())
