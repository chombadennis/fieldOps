import time
from app.db.database import SessionLocal
from app.db import crud
from app.schemas.project import Project

print("Profiling get_projects()...")
db = SessionLocal()

start_db = time.time()
db_projects = crud.get_projects(db)
end_db = time.time()
print(f"DB Query time: {end_db - start_db:.3f} seconds. (Found {len(db_projects)} projects)")

start_serialize = time.time()
serialized = [Project.model_validate(p) for p in db_projects]
end_serialize = time.time()
print(f"Pydantic serialization time: {end_serialize - start_serialize:.3f} seconds.")

db.close()
