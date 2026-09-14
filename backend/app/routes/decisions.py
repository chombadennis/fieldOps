from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import database
from ..models.decision import Decision
from ..models.action import Action
from ..models.project import Project
from ..schemas import platform as platform_schemas
from datetime import datetime

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Decisions ---

@router.get("/projects/{project_id}/decisions", response_model=List[platform_schemas.Decision])
def get_project_decisions(
    project_id: int,
    document_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(Decision).filter(Decision.project_id == project_id)
    if document_id is not None:
        query = query.filter(Decision.document_id == document_id)
        
    return query.order_by(Decision.created_at.desc()).all()

@router.post("/projects/{project_id}/decisions", response_model=platform_schemas.Decision)
def create_project_decision(
    project_id: int,
    decision_in: platform_schemas.DecisionCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Assuming current_user logic is coming later. Defaulting to None for made_by_id or a stub.
    new_decision = Decision(
        project_id=project_id,
        document_id=decision_in.document_id,
        title=decision_in.title,
        description=decision_in.description,
        made_on=datetime.strptime(decision_in.made_on, "%Y-%m-%d").date() if decision_in.made_on else None,
        status=decision_in.status
    )
    db.add(new_decision)
    db.commit()
    db.refresh(new_decision)
    return new_decision

@router.patch("/projects/{project_id}/decisions/{decision_id}", response_model=platform_schemas.Decision)
def update_project_decision(
    project_id: int,
    decision_id: int,
    decision_in: platform_schemas.DecisionUpdate,
    db: Session = Depends(get_db)
):
    decision = db.query(Decision).filter(Decision.id == decision_id, Decision.project_id == project_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
        
    update_data = decision_in.dict(exclude_unset=True)
    if 'made_on' in update_data and update_data['made_on']:
        update_data['made_on'] = datetime.strptime(update_data['made_on'], "%Y-%m-%d").date()

    for key, value in update_data.items():
        if hasattr(decision, key):
            setattr(decision, key, value)
            
    db.commit()
    db.refresh(decision)
    return decision

@router.delete("/projects/{project_id}/decisions/{decision_id}")
def delete_project_decision(
    project_id: int,
    decision_id: int,
    db: Session = Depends(get_db)
):
    decision = db.query(Decision).filter(Decision.id == decision_id, Decision.project_id == project_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
        
    db.delete(decision)
    db.commit()
    return {"message": "Decision deleted successfully"}

# --- Actions ---

@router.get("/projects/{project_id}/actions", response_model=List[platform_schemas.Action])
def get_project_actions(
    project_id: int,
    document_id: Optional[int] = None,
    decision_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Action).filter(Action.project_id == project_id)
    if document_id is not None:
        query = query.filter(Action.document_id == document_id)
    if decision_id is not None:
        query = query.filter(Action.decision_id == decision_id)
        
    return query.order_by(Action.created_at.desc()).all()

@router.post("/projects/{project_id}/actions", response_model=platform_schemas.Action)
def create_project_action(
    project_id: int,
    action_in: platform_schemas.ActionCreate,
    db: Session = Depends(get_db)
):
    new_action = Action(
        project_id=project_id,
        document_id=action_in.document_id,
        decision_id=action_in.decision_id,
        description=action_in.description,
        assignee_id=action_in.assignee_id,
        due_date=datetime.strptime(action_in.due_date, "%Y-%m-%d").date() if action_in.due_date else None,
        status=action_in.status
    )
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    return new_action

@router.patch("/projects/{project_id}/actions/{action_id}", response_model=platform_schemas.Action)
def update_project_action(
    project_id: int,
    action_id: int,
    action_in: platform_schemas.ActionUpdate,
    db: Session = Depends(get_db)
):
    action = db.query(Action).filter(Action.id == action_id, Action.project_id == project_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
        
    update_data = action_in.dict(exclude_unset=True)
    if 'due_date' in update_data and update_data['due_date']:
        update_data['due_date'] = datetime.strptime(update_data['due_date'], "%Y-%m-%d").date()

    for key, value in update_data.items():
        if hasattr(action, key):
            setattr(action, key, value)
            
    db.commit()
    db.refresh(action)
    return action

@router.delete("/projects/{project_id}/actions/{action_id}")
def delete_project_action(
    project_id: int,
    action_id: int,
    db: Session = Depends(get_db)
):
    action = db.query(Action).filter(Action.id == action_id, Action.project_id == project_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
        
    db.delete(action)
    db.commit()
    return {"message": "Action deleted successfully"}
