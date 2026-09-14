import os
import sys

# Ensure backend module is reachable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.db.database import engine
from sqlalchemy import text

def add_ai_insights_column():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE documents ADD COLUMN ai_insights JSON"))
            print("Successfully added ai_insights column to documents table.")
    except Exception as e:
        print(f"Error (maybe column already exists): {e}")

if __name__ == "__main__":
    add_ai_insights_column()
