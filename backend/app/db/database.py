import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

# Get the database URL from settings (Pydantic strictly loaded from .env)
DATABASE_URL = settings.DATABASE_URL

# Create the SQLAlchemy engine with pool_pre_ping to survive Neon idle timeouts
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Mandatory for remote Postgres like Neon during long AI runs
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class for declarative models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Ensure newly added columns exist in PostgreSQL tables without requiring full Alembic migrations."""
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS revised_amount DOUBLE PRECISION;"))
            conn.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS planned_value DOUBLE PRECISION;"))
            conn.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS earned_value DOUBLE PRECISION;"))
            conn.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS actual_cost DOUBLE PRECISION;"))
            conn.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS values_map JSONB;"))
            conn.execute(text("ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_issue BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE notes ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'Normal';"))
            conn.execute(text("ALTER TABLE milestone_claim_documents ADD COLUMN IF NOT EXISTS claim_number VARCHAR;"))
            conn.execute(text("ALTER TABLE milestone_claim_documents ADD COLUMN IF NOT EXISTS valuation_date VARCHAR;"))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS analysis_schedule_references (
                    id SERIAL PRIMARY KEY,
                    reference_source_id INTEGER NOT NULL,
                    reference_source_type VARCHAR NOT NULL,
                    activity_schedule_document_id INTEGER NOT NULL REFERENCES activity_schedule_documents(id) ON DELETE CASCADE,
                    relationship_mode VARCHAR NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS analysis_boq_references (
                    id SERIAL PRIMARY KEY,
                    reference_source_id INTEGER NOT NULL,
                    reference_source_type VARCHAR NOT NULL,
                    boq_document_id INTEGER NOT NULL REFERENCES boq_documents(id) ON DELETE CASCADE,
                    relationship_mode VARCHAR NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()
        except Exception as e:
            print(f"Migration notice: {e}")

try:
    run_migrations()
except Exception as e:
    print(f"Failed to auto-migrate database columns: {e}")

