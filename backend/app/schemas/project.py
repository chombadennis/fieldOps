from pydantic import BaseModel
from typing import Optional
from datetime import date

# --- Base Schema for common attributes ---
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

# --- Schema for creating a project (what the API receives) ---
class ProjectCreate(ProjectBase):
    pass

# --- Schema for updating a project (all fields optional) ---
class ProjectUpdate(ProjectBase):
    name: Optional[str] = None # Make all fields optional for PUT/PATCH

# --- Schema for reading a project (what the API returns) ---
class Project(ProjectBase):
    id: int

    class Config:
        from_attributes = True # Replaces orm_mode = True in Pydantic v2
