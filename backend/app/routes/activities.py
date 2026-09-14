from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..db import database
from ..models.document import Document
from ..models.note import Note
from ..models.decision import Decision
from ..models.action import Action
from ..models.project import Project
from typing import List, Dict, Any

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/projects/{project_id}/activity-feed")
def get_project_activity_feed(project_id: int, db: Session = Depends(get_db)):
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    feed: List[Dict[str, Any]] = []

    # 1. Fetch Documents
    docs = db.query(Document).filter(Document.project_id == project_id).all()
    for d in docs:
        feed.append({
            "id": f"doc-{d.id}",
            "type": "document",
            "title": f"Document {'Superseded' if d.is_archived else 'Linked'}: {d.name or d.title}",
            "description": d.context_description or "A document was linked.",
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "department": d.department,
            "metadata": {"doc_id": d.id, "file_type": d.file_type}
        })

    # 2. Fetch Notes (Discussions)
    notes = db.query(Note).filter(Note.project_id == project_id).all()
    for n in notes:
        feed.append({
            "id": f"note-{n.id}",
            "type": "note",
            "title": f"New {'Issue' if n.is_issue else 'Note'} in {n.department or 'General'}",
            "description": n.content,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "department": n.department,
            "metadata": {"note_id": n.id, "priority": n.priority}
        })

    # 3. Fetch Decisions
    decisions = db.query(Decision).filter(Decision.project_id == project_id).all()
    for dec in decisions:
        feed.append({
            "id": f"dec-{dec.id}",
            "type": "decision",
            "title": f"Decision {dec.status}: {dec.title}",
            "description": dec.description or "No description provided.",
            "created_at": dec.created_at.isoformat() if dec.created_at else None,
            "department": "Management",
            "metadata": {"decision_id": dec.id, "status": dec.status}
        })

    # 4. Fetch Actions
    actions = db.query(Action).filter(Action.project_id == project_id).all()
    for act in actions:
        feed.append({
            "id": f"act-{act.id}",
            "type": "action",
            "title": f"Action {act.status}: {act.description[:30]}...",
            "description": act.description,
            "created_at": act.created_at.isoformat() if act.created_at else None,
            "department": "Management",
            "metadata": {"action_id": act.id, "status": act.status, "due_date": act.due_date.isoformat() if act.due_date else None}
        })

    # Filter out items without created_at and sort by created_at descending
    valid_feed = [item for item in feed if item.get("created_at") is not None]
    valid_feed.sort(key=lambda x: x["created_at"], reverse=True)

    return valid_feed

