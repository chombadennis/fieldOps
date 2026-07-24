from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import database
from ..models.note import Note
from ..models.project import Project
from ..schemas import platform as platform_schemas

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/projects/{project_id}/notes", response_model=List[platform_schemas.Note])
def get_project_notes(
    project_id: int,
    contract_id: Optional[int] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from ..models.contract import Contract
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract:
            contract_id = general_contract.id

    query = db.query(Note).filter(Note.project_id == project_id)
    if contract_id is not None:
        query = query.filter(Note.contract_id == contract_id)
    if department and department != "All":
        query = query.filter(Note.department == department)
        
    return query.order_by(Note.created_at.desc()).all()

@router.post("/projects/{project_id}/notes", response_model=platform_schemas.Note)
def create_project_note(
    project_id: int,
    note_in: platform_schemas.NoteCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from ..models.contract import Contract
    contract_id = note_in.contract_id
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if not general_contract:
            general_contract = Contract(project_id=project_id, name="General Contract", contract_type="GENERAL")
            db.add(general_contract)
            db.commit()
            db.refresh(general_contract)
        contract_id = general_contract.id

    new_note = Note(
        project_id=project_id,
        contract_id=contract_id,
        content=note_in.content,
        department=note_in.department,
        is_issue=note_in.is_issue,
        priority=note_in.priority,
        author_name="Dennis Chomba"
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note
