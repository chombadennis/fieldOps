from app.db.database import SessionLocal
from app.models.document import Document

db = SessionLocal()
docs = db.query(Document).all()
for d in docs:
    print(f"ID: {d.id}, Name: {d.name}, Department: {d.department}, Integration ID: {d.integration_id}")
