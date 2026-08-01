from sqlalchemy import create_engine, text
from app.core.config import settings

print("Running PostgreSQL migration for reextract_logs...")
engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE project_integrations ADD COLUMN IF NOT EXISTS reextract_logs JSONB DEFAULT '[]'::jsonb;"))
    conn.commit()
print("Migration completed successfully!")
