import os
import sys
from dotenv import load_dotenv

# Setup path to backend app
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
project_root = os.path.abspath(os.path.join(backend_root, '..'))
sys.path.insert(0, backend_root)
load_dotenv(os.path.join(project_root, '.env'))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    engine = create_engine(settings.DATABASE_URL)
    print("Connecting to database and adding 'origin' column to boq_documents...")
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE boq_documents ADD COLUMN IF NOT EXISTS origin VARCHAR DEFAULT 'file_upload';"))
            conn.commit()
            print("Successfully added 'origin' column to boq_documents!")
    except Exception as e:
        print(f"Error executing migration: {e}")

if __name__ == "__main__":
    run_migration()
