import os
import sys
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

TEST_PROJECT_ID = 9999

def cleanup_database():
    """Finds the temporary test project and completely deletes it."""
    print("1. Logging into Neon PostgreSQL...")
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    # We query the database for our exact Dummy Project ID
    dummy_project = db.query(Project).filter(Project.id == TEST_PROJECT_ID).first()
    
    if dummy_project:
        print(f"2. Found Dummy Project '{dummy_project.name}'. Purging from database...")
        # Because we configured 'cascade=all, delete-orphan' in Phase 1, 
        # deleting this Project automatically securely deletes EVERY attached BOQ Item!
        db.delete(dummy_project)
        db.commit()
        print("✅ SUCCESS: Test Database completely scrubbed clean!")
    else:
        print("⚠️ Notice: The Dummy Project with ID 9999 wasn't found in your SQL Database. It's already perfectly clean.")

    db.close()

if __name__ == "__main__":
    cleanup_database()
