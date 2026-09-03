from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.database import get_db
from ..models.rate_schedule import RateScheduleDocument
from ..models.project import Project
from ..models.contract import Contract
from ..schemas import platform as platform_schemas
from sqlalchemy.sql import func

router = APIRouter(
    prefix="/projects/{project_id}/rate_schedule",
    tags=["Rate Schedule Documents"]
)

@router.get("", response_model=List[platform_schemas.Document])
def get_rate_schedule_documents(
    project_id: int,
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract:
            contract_id = general_contract.id

    query = db.query(RateScheduleDocument)
    if hasattr(RateScheduleDocument, 'project_id'):
        query = query.filter(RateScheduleDocument.project_id == project_id)
        
    if hasattr(RateScheduleDocument, 'contract_id') and contract_id is not None:
        query = query.filter(RateScheduleDocument.contract_id == contract_id)

    docs = query.order_by(RateScheduleDocument.created_at.desc()).all()
    
    integration_ids = [d.integration_id for d in docs if d.integration_id]
    integrations_dict = {}
    if integration_ids:
        from ..models.project_integration import ProjectIntegration
        integrations = db.query(ProjectIntegration).filter(ProjectIntegration.id.in_(integration_ids)).all()
        integrations_dict = {i.id: i for i in integrations}

    result = []
    for d in docs:
        uploaded_by = None
        cloud_email = None
        if d.integration_id and d.integration_id in integrations_dict:
            integration = integrations_dict[d.integration_id]
            uploaded_by = integration.user_id
            if integration.meta_data:
                cloud_email = integration.meta_data.get('cloud_email')

        result.append(
            platform_schemas.Document(
                id=d.id,
                project_id=getattr(d, 'project_id', project_id),
                contract_id=getattr(d, 'contract_id', None),
                title=d.name,
                file_url=d.file_url or "",
                file_type=d.file_type or "unknown",
                department="rate_schedule",
                file_size=getattr(d, 'file_size', 0),
                cloud_file_id=getattr(d, 'cloud_file_id', None),
                origin=d.origin or "file_upload",
                integration_id=d.integration_id,
                is_linked=getattr(d, 'is_linked', True),
                linked_at=getattr(d, 'linked_at', None),
                unlinked_at=getattr(d, 'unlinked_at', None),
                uploaded_by=uploaded_by,
                cloud_email=cloud_email,
                extracted_data=getattr(d, 'extracted_data', None),
                created_at=getattr(d, 'created_at', None)
            )
        )
    return result

@router.post("", response_model=platform_schemas.Document)
def create_rate_schedule_document(
    project_id: int,
    doc_in: platform_schemas.DocumentCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contract_id = doc_in.contract_id
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

    # Check for duplicates based on URL or Cloud ID
    existing_doc = None
    query = db.query(RateScheduleDocument)
    
    # We must filter by the correct foreign keys based on model schema
    if hasattr(RateScheduleDocument, 'project_id'):
        query = query.filter(RateScheduleDocument.project_id == project_id)
    if hasattr(RateScheduleDocument, 'contract_id'):
        query = query.filter(RateScheduleDocument.contract_id == contract_id)
        
    if doc_in.cloud_file_id and hasattr(RateScheduleDocument, 'cloud_file_id'):
        existing_doc = query.filter(RateScheduleDocument.cloud_file_id == doc_in.cloud_file_id).first()
    
    if not existing_doc and doc_in.file_url:
        existing_doc = query.filter(RateScheduleDocument.file_url == doc_in.file_url).first()

    if existing_doc:
        existing_doc.name = doc_in.title
        existing_doc.file_url = doc_in.file_url
        existing_doc.file_type = doc_in.file_type
        if hasattr(existing_doc, 'file_size'):
            existing_doc.file_size = doc_in.file_size
        if doc_in.integration_id:
            existing_doc.integration_id = doc_in.integration_id
            
        if hasattr(existing_doc, 'is_linked'):
            existing_doc.is_linked = True
            existing_doc.linked_at = func.now()
            existing_doc.unlinked_at = None
            
        db.commit()
        db.refresh(existing_doc)
        d = existing_doc
        return platform_schemas.Document(
            id=d.id,
            project_id=getattr(d, 'project_id', project_id),
            contract_id=getattr(d, 'contract_id', None),
            title=d.name,
            file_url=d.file_url or "",
            file_type=d.file_type or "unknown",
            department="rate_schedule",
            file_size=getattr(d, 'file_size', 0),
            cloud_file_id=getattr(d, 'cloud_file_id', None),
            origin=d.origin or "file_upload",
            integration_id=d.integration_id,
            is_linked=getattr(d, 'is_linked', True),
            linked_at=getattr(d, 'linked_at', None),
            unlinked_at=getattr(d, 'unlinked_at', None),
            created_at=getattr(d, 'created_at', None)
        )

    kwargs = {
        "name": doc_in.title,
        "file_url": doc_in.file_url,
        "file_type": doc_in.file_type,
        "origin": doc_in.origin or "file_upload",
        "integration_id": doc_in.integration_id
    }
    
    if hasattr(RateScheduleDocument, 'project_id'):
        kwargs["project_id"] = project_id
    if hasattr(RateScheduleDocument, 'contract_id'):
        kwargs["contract_id"] = contract_id
    if hasattr(RateScheduleDocument, 'cloud_file_id'):
        kwargs["cloud_file_id"] = doc_in.cloud_file_id
    if hasattr(RateScheduleDocument, 'file_size'):
        kwargs["file_size"] = doc_in.file_size
    if hasattr(RateScheduleDocument, 'is_linked'):
        kwargs["is_linked"] = True
        kwargs["linked_at"] = func.now()

    new_doc = RateScheduleDocument(**kwargs)
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    d = new_doc
    return platform_schemas.Document(
        id=d.id,
        project_id=getattr(d, 'project_id', project_id),
        contract_id=getattr(d, 'contract_id', None),
        title=d.name,
        file_url=d.file_url or "",
        file_type=d.file_type or "unknown",
        department="rate_schedule",
        file_size=getattr(d, 'file_size', 0),
        cloud_file_id=getattr(d, 'cloud_file_id', None),
        origin=d.origin or "file_upload",
        integration_id=d.integration_id,
        is_linked=getattr(d, 'is_linked', True),
        linked_at=getattr(d, 'linked_at', None),
        unlinked_at=getattr(d, 'unlinked_at', None),
        created_at=getattr(d, 'created_at', None)
    )

@router.post("/{document_id}/unlink")
def unlink_rate_schedule_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db)
):
    doc = db.query(RateScheduleDocument).filter(RateScheduleDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if hasattr(doc, 'project_id') and doc.project_id != project_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this project")

    if hasattr(doc, 'is_linked'):
        doc.is_linked = False
        doc.unlinked_at = func.now()
        db.commit()
        db.refresh(doc)
    return {"status": "unlinked"}

@router.delete("/{document_id}")
def delete_rate_schedule_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db)
):
    doc = db.query(RateScheduleDocument).filter(RateScheduleDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if hasattr(doc, 'project_id') and doc.project_id != project_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this project")

    # Step 1: Delete integration if attached
    if getattr(doc, 'integration_id', None):
        from ..models.project_integration import ProjectIntegration
        db.query(ProjectIntegration).filter(ProjectIntegration.id == doc.integration_id).delete(synchronize_session=False)

    # Step 2: Permanently delete document data from database
    db.delete(doc)
    db.commit()
    return {"status": "deleted", "message": "Document data and integration permanently deleted from database"}
