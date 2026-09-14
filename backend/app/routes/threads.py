import html
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ..db import database
from ..models.thread import Thread
from ..models.thread_reply import ThreadReply
from ..models.notification import Notification
from ..models.project import Project
from ..models.log_entry import LogEntry
from ..schemas import platform as s

router = APIRouter()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_notification(db: Session, user_id: int, notif_type: str, ref_id: int, ref_type: str, message: str):
    """Helper to create a notification row."""
    notif = Notification(
        user_id=user_id,
        notif_type=notif_type,
        reference_id=ref_id,
        reference_type=ref_type,
        message=message,
    )
    db.add(notif)


# ─── Threads ──────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/threads", response_model=List[s.Thread])
def get_threads(
    project_id: int,
    module: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = (
        db.query(Thread)
        .options(joinedload(Thread.replies))
        .filter(Thread.project_id == project_id)
    )
    if module:
        query = query.filter(Thread.module == module)
    if status:
        query = query.filter(Thread.status == status)

    return query.order_by(Thread.created_at.desc()).all()


@router.post("/projects/{project_id}/threads", response_model=s.Thread)
def create_thread(
    project_id: int,
    thread_in: s.ThreadCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not thread_in.subject.strip():
        raise HTTPException(status_code=400, detail="Thread subject cannot be empty")

    thread = Thread(
        project_id=project_id,
        subject=thread_in.subject.strip(),
        module=thread_in.module,
        status="open",
        created_by_name=thread_in.created_by_name or "Anonymous",
        linked_document_ids=thread_in.linked_document_ids or [],
    )
    db.add(thread)
    db.flush()  # get thread.id without full commit

    # Optionally create the first reply (opening message)
    if thread_in.first_reply and thread_in.first_reply.strip():
        reply = ThreadReply(
            thread_id=thread.id,
            content=html.escape(thread_in.first_reply.strip()),
            author_name=thread_in.created_by_name or "Anonymous",
        )
        db.add(reply)

    db.commit()
    db.refresh(thread)
    return thread


@router.patch("/projects/{project_id}/threads/{thread_id}", response_model=s.Thread)
def update_thread(
    project_id: int,
    thread_id: int,
    thread_in: s.ThreadUpdate,
    db: Session = Depends(get_db),
):
    thread = db.query(Thread).filter(Thread.id == thread_id, Thread.project_id == project_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    update_data = thread_in.dict(exclude_unset=True)
    
    # Check if we are resolving this thread to trigger an automated LogEntry
    is_resolving = update_data.get("status") == "resolved" and thread.status != "resolved"
    
    for key, val in update_data.items():
        setattr(thread, key, val)

    if is_resolving:
        log_entry = LogEntry(
            project_id=project_id,
            module=thread.module,
            thread_id=thread.id,
            entry_type="Decision",
            title=f"Resolved: {thread.subject}",
            content="This discussion thread has been marked as resolved by the team.",
            posted_by_name="System Automation",
        )
        db.add(log_entry)

    db.commit()
    db.refresh(thread)
    return thread


# ─── Thread Replies ───────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/threads/{thread_id}/replies", response_model=List[s.ThreadReply])
def get_replies(
    project_id: int,
    thread_id: int,
    db: Session = Depends(get_db),
):
    thread = db.query(Thread).filter(Thread.id == thread_id, Thread.project_id == project_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    replies = (
        db.query(ThreadReply)
        .filter(ThreadReply.thread_id == thread_id)
        .order_by(ThreadReply.created_at.asc())
        .all()
    )
    return replies


@router.post("/projects/{project_id}/threads/{thread_id}/replies", response_model=s.ThreadReply)
def create_reply(
    project_id: int,
    thread_id: int,
    reply_in: s.ThreadReplyCreate,
    db: Session = Depends(get_db),
):
    thread = db.query(Thread).filter(Thread.id == thread_id, Thread.project_id == project_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if not reply_in.content.strip():
        raise HTTPException(status_code=400, detail="Reply content cannot be empty")

    reply = ThreadReply(
        thread_id=thread_id,
        content=html.escape(reply_in.content.strip()),
        author_name=reply_in.author_name or "Anonymous",
        is_issue=reply_in.is_issue,
        mentions_raw=reply_in.mentions_raw,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    # Notify thread opener if they have an account
    if thread.created_by_id:
        _create_notification(
            db,
            user_id=thread.created_by_id,
            notif_type="reply_received",
            ref_id=thread_id,
            ref_type="thread",
            message=f"New reply on thread: '{thread.subject}'",
        )
        db.commit()

    return reply
