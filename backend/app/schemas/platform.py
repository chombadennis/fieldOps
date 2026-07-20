from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- User Schema ---
class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    role: str = "engineer"  # admin, engineer, hr, legal, field_officer
    department: Optional[str] = "Tech"
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    company_id: Optional[int] = None
    firebase_uid: Optional[str] = None

class User(UserBase):
    id: int
    company_id: Optional[int] = None
    firebase_uid: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Budget Schema ---
class BudgetBase(BaseModel):
    category: str
    amount: float
    allocated_date: Optional[str] = None
    description: Optional[str] = None

class BudgetCreate(BudgetBase):
    pass

class Budget(BudgetBase):
    id: int
    project_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- IPC Schema ---
class IPCBase(BaseModel):
    certificate_number: str
    amount_claimed: float
    amount_certified: Optional[float] = 0.0
    status: str = "Draft"  # Draft, Submitted, Certified, Paid
    issued_date: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None

class IPCCreate(IPCBase):
    pass

class IPC(IPCBase):
    id: int
    project_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Document Schema ---
class DocumentBase(BaseModel):
    title: str
    file_url: str
    file_type: Optional[str] = "pdf"
    department: Optional[str] = "General"
    file_size: Optional[int] = 0
    cloud_file_id: Optional[str] = None
    origin: Optional[str] = "file_upload"
    integration_id: Optional[int] = None  # FK to project_integrations — used for embed URL generation

class DocumentCreate(DocumentBase):
    note_id: Optional[int] = None

class Document(DocumentBase):
    id: int
    project_id: int
    note_id: Optional[int] = None
    uploaded_by: Optional[int] = None
    is_linked: bool = True
    linked_at: Optional[datetime] = None
    unlinked_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Note Schema ---
class NoteBase(BaseModel):
    content: str
    department: str = "Tech"  # Tech, Field Operations, HR, Legal, General
    is_issue: Optional[bool] = False
    priority: Optional[str] = "Normal"  # Low, Normal, High, Urgent

class NoteCreate(NoteBase):
    pass

class Note(NoteBase):
    id: int
    project_id: int
    user_id: Optional[int] = None
    author_name: Optional[str] = "Anonymous"
    created_at: Optional[datetime] = None
    documents: List[Document] = []

    class Config:
        from_attributes = True
