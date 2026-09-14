from sqlalchemy import create_engine, text
from app.core.config import settings

print("Running PostgreSQL migration for linked_document_ids...")
engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE threads ADD COLUMN IF NOT EXISTS linked_document_ids integer[] DEFAULT '{}';"))
    conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linked_document_ids integer[] DEFAULT '{}';"))
    conn.commit()
print("Migration completed successfully!")
