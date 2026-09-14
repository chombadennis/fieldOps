from pydantic import BaseModel
from typing import Optional, List, Any
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
    category: Optional[str] = "General"
    name: Optional[str] = None
    amount: float
    revised_amount: Optional[float] = None
    planned_value: Optional[float] = None
    earned_value: Optional[float] = None
    actual_cost: Optional[float] = None
    values_map: Optional[Any] = None
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
    file_url: Optional[str] = None
    file_type: Optional[str] = "pdf"
    department: Optional[str] = "General"
    file_size: Optional[int] = 0
    cloud_file_id: Optional[str] = None
    origin: Optional[str] = "file_upload"
    integration_id: Optional[int] = None  # FK to project_integrations — used for embed URL generation
    extracted_data: Optional[dict] = None
    supersedes_id: Optional[int] = None
    revision_label: Optional[str] = None
    is_archived: Optional[bool] = False
    ai_insights: Optional[dict] = None

class DocumentUpdate(BaseModel):
    extracted_data: Optional[dict] = None
    context_description: Optional[str] = None
    link_reason: Optional[str] = None
    review_requested_from: Optional[list] = None
    supersedes_id: Optional[int] = None
    revision_label: Optional[str] = None
    is_archived: Optional[bool] = None

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
    cloud_email: Optional[str] = None
    context_description: Optional[str] = None
    link_reason: Optional[str] = None
    review_requested_from: Optional[list] = None
    ai_insights: Optional[dict] = None

    class Config:
        from_attributes = True

# --- Note Schema ---
class NoteBase(BaseModel):
    content: str
    department: str = "Tech"  # Tech, Field Operations, HR, Legal, General
    is_issue: Optional[bool] = False
    priority: Optional[str] = "Normal"  # Low, Normal, High, Urgent
    follow_up_date: Optional[str] = None # Date string
    values_map: Optional[dict] = None
    document_id: Optional[int] = None

class NoteCreate(NoteBase):
    contract_id: Optional[int] = None
    document_ids: Optional[List[int]] = []

class NoteUpdate(BaseModel):
    content: Optional[str] = None
    department: Optional[str] = None
    is_issue: Optional[bool] = None
    priority: Optional[str] = None
    follow_up_date: Optional[str] = None
    values_map: Optional[dict] = None
    document_ids: Optional[List[int]] = None

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

# --- Milestone Claim Schema ---
class MilestoneClaimItemSchema(BaseModel):
    activity_id: Optional[str] = None
    description: str
    percentage_complete_this_period: Optional[float] = 0.0
    amount_claimed_this_period: Optional[float] = 0.0
    amount_certified: Optional[float] = 0.0
    status: Optional[str] = "pending"
    values_map: Optional[dict] = None

class MilestoneClaimSchema(BaseModel):
    id: Optional[int] = None
    project_id: int
    contract_id: Optional[int] = None
    name: str
    file_url: Optional[str] = None
    file_type: Optional[str] = "pdf"
    gross_amount_claimed: Optional[float] = 0.0
    retention_deducted: Optional[float] = 0.0
    net_amount_due: Optional[float] = 0.0
    status: str = "Draft"
    payment_status: str = "UNPAID"
    values_map: Optional[dict] = None
    integration_id: Optional[int] = None

    class Config:
        from_attributes = True

class FullMilestoneExtractionSchema(BaseModel):
    metrics: dict
    items: List[MilestoneClaimItemSchema]
    is_milestone_document: bool
    identified_document_type: str
    validation_status: str
    confidence_score: int
    validation_issues: List[str]

# --- Decision Schema ---
class DecisionBase(BaseModel):
    title: str
    description: Optional[str] = None
    made_on: Optional[Any] = None
    status: Optional[str] = "Approved"

class DecisionCreate(DecisionBase):
    document_id: Optional[int] = None
    made_by_id: Optional[int] = None

class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class Decision(DecisionBase):
    id: int
    project_id: int
    document_id: Optional[int] = None
    made_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Action Schema ---
class ActionBase(BaseModel):
    description: str
    due_date: Optional[Any] = None
    status: Optional[str] = "Pending"

class ActionCreate(ActionBase):
    document_id: Optional[int] = None
    decision_id: Optional[int] = None
    assignee_id: Optional[int] = None

class ActionUpdate(BaseModel):
    description: Optional[str] = None
    due_date: Optional[Any] = None
    status: Optional[str] = None
    assignee_id: Optional[int] = None

class Action(ActionBase):
    id: int
    project_id: int
    document_id: Optional[int] = None
    decision_id: Optional[int] = None
    assignee_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Collaboration System Schemas ─────────────────────────────────────────────

# --- ThreadReply ---
class ThreadReplyBase(BaseModel):
    content: str
    is_issue: Optional[bool] = False
    mentions_raw: Optional[str] = None  # comma-separated user ids

class ThreadReplyCreate(ThreadReplyBase):
    author_name: Optional[str] = None

class ThreadReplyUpdate(BaseModel):
    content: Optional[str] = None
    is_issue: Optional[bool] = None

class ThreadReply(ThreadReplyBase):
    id: int
    thread_id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Thread ---
class ThreadBase(BaseModel):
    subject: str
    module: str = "General"
    status: Optional[str] = "open"

class ThreadCreate(ThreadBase):
    first_reply: Optional[str] = None  # Optional opening message body
    created_by_name: Optional[str] = None
    linked_document_ids: Optional[List[int]] = []

class ThreadUpdate(BaseModel):
    status: Optional[str] = None
    subject: Optional[str] = None
    linked_document_ids: Optional[List[int]] = None

class Thread(ThreadBase):
    id: int
    project_id: int
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    replies: List[ThreadReply] = []
    linked_document_ids: Optional[List[int]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Task ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    module: Optional[str] = None
    priority: Optional[str] = "Normal"
    due_date: Optional[Any] = None
    reminder_at: Optional[Any] = None

class TaskCreate(TaskBase):
    thread_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None
    linked_document_ids: Optional[List[int]] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[Any] = None
    reminder_at: Optional[Any] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    resolution_note: Optional[str] = None
    linked_document_ids: Optional[List[int]] = None

class Task(TaskBase):
    id: int
    project_id: int
    thread_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    status: Optional[str] = "Open"
    resolution_note: Optional[str] = None
    completed_at: Optional[datetime] = None
    linked_document_ids: Optional[List[int]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- LogEntry ---
class LogEntryBase(BaseModel):
    entry_type: str  # Decision, Success, Failure, Risk, Issue, Resolved
    title: str
    content: str
    module: Optional[str] = None

class LogEntryCreate(LogEntryBase):
    task_id: Optional[int] = None
    thread_id: Optional[int] = None
    posted_by_name: Optional[str] = None

class LogEntry(LogEntryBase):
    id: int
    project_id: int
    task_id: Optional[int] = None
    thread_id: Optional[int] = None
    posted_by_id: Optional[int] = None
    posted_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Notification ---
class NotificationBase(BaseModel):
    notif_type: str
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    message: Optional[str] = None

class Notification(NotificationBase):
    id: int
    user_id: int
    is_read: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
