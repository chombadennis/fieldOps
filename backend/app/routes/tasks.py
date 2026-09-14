from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from ..db import database
from ..models.task import Task
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
    notif = Notification(
        user_id=user_id,
        notif_type=notif_type,
        reference_id=ref_id,
        reference_type=ref_type,
        message=message,
    )
    db.add(notif)


@router.get("/projects/{project_id}/tasks", response_model=List[s.Task])
def get_tasks(
    project_id: int,
    module: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(Task).filter(Task.project_id == project_id)
    if module:
        query = query.filter(Task.module == module)
    if status:
        query = query.filter(Task.status == status)
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)

    return query.order_by(Task.created_at.desc()).all()


@router.post("/projects/{project_id}/tasks", response_model=s.Task)
def create_task(
    project_id: int,
    task_in: s.TaskCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not task_in.title.strip():
        raise HTTPException(status_code=400, detail="Task title cannot be empty")

    task = Task(
        project_id=project_id,
        title=task_in.title.strip(),
        description=task_in.description,
        module=task_in.module,
        thread_id=task_in.thread_id,
        assigned_to_id=task_in.assigned_to_id,
        assigned_to_name=task_in.assigned_to_name,
        created_by_name=task_in.created_by_name,
        priority=task_in.priority or "Normal",
        due_date=task_in.due_date,
        reminder_at=task_in.reminder_at,
        status="Open",
        linked_document_ids=task_in.linked_document_ids or [],
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Notify the assignee if they have an account
    if task.assigned_to_id:
        _create_notification(
            db,
            user_id=task.assigned_to_id,
            notif_type="task_assigned",
            ref_id=task.id,
            ref_type="task",
            message=f"You have been assigned a task: '{task.title}'",
        )
        db.commit()

    return task


@router.patch("/projects/{project_id}/tasks/{task_id}", response_model=s.Task)
def update_task(
    project_id: int,
    task_id: int,
    task_in: s.TaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    update_data = task_in.dict(exclude_unset=True)

    # If marking as Done or Failed, record completion timestamp
    new_status = update_data.get("status")
    if new_status in ("Done", "Failed") and old_status not in ("Done", "Failed"):
        update_data["completed_at"] = datetime.now(timezone.utc)

    # If marking Failed, resolution_note is required
    if new_status == "Failed" and not update_data.get("resolution_note") and not task.resolution_note:
        raise HTTPException(status_code=400, detail="A resolution note is required when marking a task as Failed")

    for key, val in update_data.items():
        setattr(task, key, val)
        
    if new_status in ("Done", "Failed") and old_status not in ("Done", "Failed"):
        entry_type = "Success" if new_status == "Done" else "Failure"
        log_entry = LogEntry(
            project_id=project_id,
            module=task.module,
            task_id=task.id,
            entry_type=entry_type,
            title=f"Task {new_status}: {task.title}",
            content=task.resolution_note or f"Task was marked as {new_status}.",
            posted_by_name="System Automation",
        )
        db.add(log_entry)

    db.commit()
    db.refresh(task)

    # Notify the creator when task changes to Done/Failed
    if new_status in ("Done", "Failed") and task.created_by_id:
        label = "completed" if new_status == "Done" else "marked as failed"
        _create_notification(
            db,
            user_id=task.created_by_id,
            notif_type="task_completed",
            ref_id=task.id,
            ref_type="task",
            message=f"Task '{task.title}' was {label}",
        )
        db.commit()

    return task


@router.delete("/projects/{project_id}/tasks/{task_id}")
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}
