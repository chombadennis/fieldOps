from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import database
from ..models.log_entry import LogEntry
from ..models.project import Project
from ..schemas import platform as s

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


VALID_TYPES = {"Decision", "Success", "Failure", "Risk", "Issue", "Resolved"}


@router.get("/projects/{project_id}/log-entries", response_model=List[s.LogEntry])
def get_log_entries(
    project_id: int,
    module: Optional[str] = None,
    entry_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(LogEntry).filter(LogEntry.project_id == project_id)
    if module:
        query = query.filter(LogEntry.module == module)
    if entry_type:
        query = query.filter(LogEntry.entry_type == entry_type)

    return query.order_by(LogEntry.created_at.desc()).all()


@router.post("/projects/{project_id}/log-entries", response_model=s.LogEntry)
def create_log_entry(
    project_id: int,
    entry_in: s.LogEntryCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if entry_in.entry_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid entry_type. Must be one of: {', '.join(VALID_TYPES)}")

    if not entry_in.title.strip() or not entry_in.content.strip():
        raise HTTPException(status_code=400, detail="Title and content are required")

    entry = LogEntry(
        project_id=project_id,
        module=entry_in.module,
        task_id=entry_in.task_id,
        thread_id=entry_in.thread_id,
        entry_type=entry_in.entry_type,
        title=entry_in.title.strip(),
        content=entry_in.content.strip(),
        posted_by_name=entry_in.posted_by_name or "Anonymous",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
