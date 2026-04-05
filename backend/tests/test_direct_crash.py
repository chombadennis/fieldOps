import os
import sys
import asyncio
import json
from dotenv import load_dotenv

# Setup paths for backend imports
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
project_root = os.path.abspath(os.path.join(backend_root, '..'))
sys.path.insert(0, project_root)
load_dotenv(os.path.join(project_root, '.env'))

from backend.app.services.ai_extractor import get_ai_extraction
import tempfile
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

async def run_direct():
    print("\n" + "="*80)
    print("STARTING FULL PRODUCTION PIPELINE (Phase 2 Final)")
    print("="*80)
    
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
            
        print(f"File: {pdf_path}")
        print(f"Model: Gemini 2.5 Flash")
        print("-" * 50)
        
        # This calls the production service which uses httpx, state injection, and 429 retries
        result = await get_ai_extraction(
            text="See the attached visual PDF document.",
            file_path=temp_pdf_path,
            mime_type="application/pdf"
        )
        
        print("\n" + "="*80)
        print("EXTRACTION COMPLETE")
        print("="*80)
        print(json.dumps(result, indent=2))
        print("="*80)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)

if __name__ == "__main__":
    asyncio.run(run_direct())
