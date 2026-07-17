from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

# --- Integration Schema ---
class ProjectIntegration(BaseModel):
    id: int
    provider: str
    spreadsheet_id: str
    sheet_name: str
    boq_name: Optional[str] = None
    last_synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- BoqDocument Schema ---
class BoqDocument(BaseModel):
    id: int
    project_id: int
    name: str
    file_hash: str
    origin: Optional[str] = "file_upload"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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
    integrations: List[ProjectIntegration] = []
    boq_documents: List[BoqDocument] = []

    class Config:
        from_attributes = True # Replaces orm_mode = True in Pydantic v2
