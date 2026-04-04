import os
import sys
import httpx
import asyncio
from dotenv import load_dotenv

# The script is in backend/tests, so we need to step back twice to hit the absolute root
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
project_root = os.path.abspath(os.path.join(backend_root, '..'))

sys.path.insert(0, backend_root)
load_dotenv(os.path.join(project_root, '.env'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.project import Project
from app.models.boq_item import BoqItem

TEST_PROJECT_ID = 9999

def setup_dummy_project():
    """Creates a temporary project in PostgreSQL so the backend has a bucket to attach the BOQ to."""
    print("1. Connecting to Neon PostgreSQL...")
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    # Check if dummy exists
    project = db.query(Project).filter(Project.id == TEST_PROJECT_ID).first()
    if not project:
        print("   -> Creating Dummy Project with ID 9999...")
        project = Project(id=TEST_PROJECT_ID, name="Integration Test Project", location="Test Lab")
        db.add(project)
        db.commit()
    else:
        print("   -> Dummy Project 9999 already exists.")
    
    db.close()
    return True

async def simulate_frontend_upload():
    """Acts exactly like your web browser clicking 'Submit' with a multi-part form."""
    pdf_path = os.path.join(os.path.dirname(__file__), "test_data", "sample_boq.pdf")
    
    if not os.path.exists(pdf_path):
        print(f"\n❌ ERROR: Cannot find the PDF! Please place your BOQ document exactly here:\n   {pdf_path}")
        return

    print("2. Simulating a Frontend Upload to your FastAPI Route...")
    url = "http://127.0.0.1:8000/api/ai/parse-boq"
    
    try:
        # We set timeout to None (unlimited wait) because the Free Tier requires 60s cool-downs during Rate Limits.
        async with httpx.AsyncClient(timeout=None) as client:
            with open(pdf_path, "rb") as f:
                # We send the file AND the project_id just like an HTML <form>
                files = {"file": ("sample_boq.pdf", f, "application/pdf")}
                data = {"project_id": str(TEST_PROJECT_ID)}
                
                print("   -> Contacting Gemini... The connection is OPEN. Please wait.")
                print("   -> (PRO TIP: Check your Uvicorn terminal for page-by-page progress logs!)\n")
                
                # Start the request in a task so we can show a heartbeat timer
                request_task = asyncio.create_task(client.post(url, data=data, files=files))
                
                seconds = 0
                while not request_task.done():
                    await asyncio.sleep(5)
                    seconds += 5
                    print(f"      [Waiting... {seconds}s elapsed]")
                
                response = await request_task
                
            if response.status_code == 200:
                print("\n✅ SUCCESS: Fast API returned 200 OK!")
                result = response.json()
                items = result.get("extracted_data", {}).get("boq_items", [])
                print(f"   -> Successfully extracted {len(items)} items using {result.get('source')}.")
                print("\nHere are the first 3 items saved to your Neon Database:")
                for item in items[:3]:
                    print(f"      - Item {item.get('bill_item_number')}: {item.get('description')[:30]}... | Rate: {item.get('rate')}")
            else:
                print(f"\n❌ SERVER ERROR ({response.status_code}): {response.text}")

    except httpx.ConnectError:
        print("\n❌ ERROR: Could not connect to the Backend server.")
        print("   Make sure your FastAPI server is running in a different terminal using: 'uvicorn app.main:app --reload'")

if __name__ == "__main__":
    setup_dummy_project()
    asyncio.run(simulate_frontend_upload())
