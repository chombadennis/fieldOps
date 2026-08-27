import sys, os, json
sys.path.append(os.path.abspath(os.path.join('.', '..')))
from app.db.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    res = conn.execute(text("SELECT id, values_map FROM documents WHERE department='milestone_claims' LIMIT 1")).fetchone()
    if res:
        print(f"Document ID: {res[0]}")
        print(json.dumps(res[1], indent=2))
    else:
        print("No milestone claims found.")
