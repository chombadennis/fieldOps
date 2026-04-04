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
