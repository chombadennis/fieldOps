import time
from sqlalchemy import create_engine, text

urls = {
    "Direct Endpoint": "postgresql://neondb_owner:npg_yZDWMBw1aPE7@ep-royal-river-aho0hk2j.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require",
    "Pooler Endpoint": "postgresql://neondb_owner:npg_yZDWMBw1aPE7@ep-royal-river-aho0hk2j-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
}

for label, url in urls.items():
    print(f"\nTesting {label}...")
    start = time.time()
    engine = create_engine(url)
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id, name FROM projects;")).fetchall()
    end = time.time()
    print(f"{label} returned {len(res)} rows in {end - start:.3f} seconds!")
