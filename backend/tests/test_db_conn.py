import os
import time
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

urls = {
    "Configured Endpoint": os.environ.get("DATABASE_URL")
}

for label, url in urls.items():
    print(f"\nTesting {label}...")
    start = time.time()
    engine = create_engine(url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id, name FROM projects;")).fetchall()
    end = time.time()
    print(f"{label} returned {len(res)} rows in {end - start:.3f} seconds!")
