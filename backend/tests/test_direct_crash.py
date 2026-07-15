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

import hashlib

async def run_direct():
    print("\n" + "="*80)
    print("STARTING DIRECT EXTRACTION WITH LOCAL CACHE FALLBACK")
    print("="*80)
    
    # 1. Define paths
    tests_dir = os.path.dirname(__file__)
    pdf_path = os.path.join(tests_dir, "test_data", "sample_boq.pdf")
    cache_dir = os.path.join(tests_dir, "cache_local")
    output_dir = os.path.join(tests_dir, "tests_output")
    
    if not os.path.exists(pdf_path):
        print(f"ERROR: Cannot find {pdf_path}")
        return
        
    with open(pdf_path, 'rb') as f:
        contents = f.read()
        
    # 2. Generate SHA-256 fingerprint of the test BOQ
    file_hash = hashlib.sha256(contents).hexdigest()
    cache_file = os.path.join(cache_dir, f"{file_hash}.json")
    output_file = os.path.join(output_dir, "sample_boq_extracted.json")

    # 3. Check local cache first (DISABLED TEMPORARILY FOR LIVE TEST)
    if False and os.path.exists(cache_file):
        print(f"🟢 LOCAL CACHE HIT: Reusing cached parser results for hash {file_hash[:8]}...")
        with open(cache_file, "r") as f:
            result = json.load(f)
        
        # Ensure we write/update a copy in the output inspect folder as well
        os.makedirs(output_dir, exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2)
            
        print("\n" + "="*80)
        print("EXTRACTION COMPLETE (RELOADED FROM CACHE)")
        print("="*80)
        print(json.dumps(result, indent=2))
        print("="*80)
        return

    # 4. Cache Miss - Execute Gemini Call
    print(f"❌ LOCAL CACHE MISS: Processing PDF with Vertex AI (Gemini 3.5 Flash)...")
    fd, temp_pdf_path = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(contents)
            
        result = await get_ai_extraction(
            text="See the attached visual PDF document.",
            file_path=temp_pdf_path,
            mime_type="application/pdf"
        )
        
        if "error" in result:
            print(f"🔴 AI Extraction failed: {result.get('error')}")
            return

        # 5. Save results to local cache and human-readable output folders
        os.makedirs(cache_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        
        with open(cache_file, "w") as f:
            json.dump(result, f, indent=2)
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2)
            
        print(f"🟢 Caching Complete: Output saved to local cache and tests_output/ folder.")
        
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
