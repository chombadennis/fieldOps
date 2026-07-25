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
    contract_id: Optional[int] = None

class Budget(BudgetBase):
    id: int
    project_id: int
    contract_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- IPC Schema ---
class IPCBase(BaseModel):
    certificate_number: str
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    valuation_date: Optional[str] = None
    
    gross_amount_claimed: Optional[float] = 0.0
    gross_amount_certified: Optional[float] = 0.0
    total_deductions: Optional[float] = 0.0
    net_amount_due: Optional[float] = 0.0
    cumulative_certified: Optional[float] = 0.0
    
    status: str = "Draft"  # Draft, Submitted, Certified, Paid
    payment_status: str = "UNPAID" # UNPAID, PARTIALLY_PAID, PAID
    unpaid_amount: Optional[float] = 0.0
    payment_date: Optional[str] = None
    payment_reference: Optional[str] = None
    
    values_map: Optional[dict] = None

class IPCCreate(IPCBase):
    contract_id: Optional[int] = None

class IPCUpdate(BaseModel):
    certificate_number: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    valuation_date: Optional[str] = None
    gross_amount_claimed: Optional[float] = None
    gross_amount_certified: Optional[float] = None
    total_deductions: Optional[float] = None
    net_amount_due: Optional[float] = None
    cumulative_certified: Optional[float] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None
    unpaid_amount: Optional[float] = None
    payment_date: Optional[str] = None
    payment_reference: Optional[str] = None
    values_map: Optional[dict] = None

class IPC(IPCBase):
    id: int
    project_id: int
    contract_id: Optional[int] = None
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
    contract_id: Optional[int] = None

class Document(DocumentBase):
    id: int
    project_id: int
    contract_id: Optional[int] = None
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
    contract_id: Optional[int] = None

class Note(NoteBase):
    id: int
    project_id: int
    contract_id: Optional[int] = None
    user_id: Optional[int] = None
    author_name: Optional[str] = "Anonymous"
    created_at: Optional[datetime] = None
    documents: List[Document] = []

    class Config:
        from_attributes = True
