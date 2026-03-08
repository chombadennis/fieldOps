#!/usr/bin/env python
import os
import sys
from dotenv import load_dotenv

# Add the project root to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv()

from backend.app.db.database import engine, Base
# The models are now loaded via the __init__.py in the models directory

def init_db():
    print("Creating database tables...")
    # The magic line!
    # This finds all classes that inherit from Base and creates tables for them.
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")

if __name__ == "__main__":
    init_db()
