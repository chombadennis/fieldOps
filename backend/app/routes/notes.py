import html
import re
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

    if not note_in.content or not note_in.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    word_count = len(re.findall(r'\b\w+\b', note_in.content))
    if word_count > 750:
        raise HTTPException(status_code=400, detail=f"Note exceeds 750 words limit. Current word count: {word_count}")

    # Basic XSS defense: escape any raw HTML sent from client
    sanitized_content = html.escape(note_in.content.strip())

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
        content=sanitized_content,
        department=note_in.department,
        is_issue=note_in.is_issue,
        priority=note_in.priority,
        follow_up_date=note_in.follow_up_date,
        values_map=note_in.values_map,
        author_name="Dennis Chomba"
    )
    db.add(new_note)
    db.commit()
    
    # Store referenced document IDs directly in values_map to avoid schema changes
    if note_in.document_ids:
        if new_note.values_map is None:
            new_note.values_map = {}
        # We need to explicitly copy and update because SQLAlchemy JSONB doesn't always track dict mutations
        updated_map = dict(new_note.values_map)
        updated_map['document_ids'] = note_in.document_ids
        new_note.values_map = updated_map
        db.commit()

    db.refresh(new_note)
    return new_note

@router.patch("/projects/{project_id}/notes/{note_id}", response_model=platform_schemas.Note)
def update_project_note(
    project_id: int,
    note_id: int,
    note_in: platform_schemas.NoteUpdate,
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.project_id == project_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    # TODO: Add real auth check here when user auth is fully implemented.
    # Allow admins to bypass this later.
    # if current_user.id != note.author_id and not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Not authorized to edit this note")
        
    update_data = note_in.dict(exclude_unset=True)
    
    if 'content' in update_data and update_data['content'] is not None:
        sanitized_content = html.escape(update_data['content'].strip())
        note.content = sanitized_content
        del update_data['content']
        
    # Handle document_ids separately to merge into values_map
    if 'document_ids' in update_data:
        doc_ids = update_data.pop('document_ids')
        if doc_ids is not None:
            if note.values_map is None:
                note.values_map = {}
            updated_map = dict(note.values_map)
            updated_map['document_ids'] = doc_ids
            note.values_map = updated_map

    for key, value in update_data.items():
        if hasattr(note, key):
            setattr(note, key, value)
            
    db.commit()
    db.refresh(note)
    return note

@router.delete("/projects/{project_id}/notes/{note_id}")
def delete_project_note(
    project_id: int,
    note_id: int,
    db: Session = Depends(get_db)
):
    note = db.query(Note).filter(Note.id == note_id, Note.project_id == project_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    # TODO: Add real auth check here when user auth is fully implemented.
    # Allow admins to bypass this later.
    # if current_user.id != note.author_id and not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Not authorized to delete this note")
        
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}
