from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

class CustomBase:
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    created_by = Column(String) # This will be the user's ID
    last_updated_by = Column(String) # This will be the user's ID
