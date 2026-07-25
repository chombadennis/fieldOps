from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.database import get_db
from ..models.ipc_document import IpcDocument
from ..models.project import Project
from ..models.contract import Contract
from ..schemas import platform as platform_schemas
from sqlalchemy.sql import func

router = APIRouter(
    prefix="/projects/{project_id}/ipc",
    tags=["IPC Documents"]
)

@router.get("", response_model=List[platform_schemas.Document])
def get_ipc_documents(
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
    query = db.query(IpcDocument).filter(IpcDocument.is_linked == True)
    if hasattr(IpcDocument, 'project_id'):
        query = query.filter(IpcDocument.project_id == project_id)
        
    if hasattr(IpcDocument, 'contract_id') and contract_id is not None:
        query = query.filter(IpcDocument.contract_id == contract_id)

    docs = query.order_by(IpcDocument.created_at.desc()).all()
    result = []
    for d in docs:
        result.append(
            platform_schemas.Document(
                id=d.id,
                project_id=getattr(d, 'project_id', project_id),
                contract_id=getattr(d, 'contract_id', None),
                title=d.name,
                file_url=d.file_url or "",
                file_type=d.file_type or "unknown",
                department="ipc",
                file_size=getattr(d, 'file_size', 0),
                cloud_file_id=getattr(d, 'cloud_file_id', None),
                origin=d.origin or "file_upload",
                integration_id=d.integration_id,
                is_linked=getattr(d, 'is_linked', True),
                linked_at=getattr(d, 'linked_at', None),
                unlinked_at=getattr(d, 'unlinked_at', None),
                created_at=getattr(d, 'created_at', None)
            )
        )
    return result

@router.post("", response_model=platform_schemas.Document)
def create_ipc_document(
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
    query = db.query(IpcDocument)
    
    # We must filter by the correct foreign keys based on model schema
    if hasattr(IpcDocument, 'project_id'):
        query = query.filter(IpcDocument.project_id == project_id)
    if hasattr(IpcDocument, 'contract_id'):
        query = query.filter(IpcDocument.contract_id == contract_id)
        
    if doc_in.cloud_file_id and hasattr(IpcDocument, 'cloud_file_id'):
        existing_doc = query.filter(IpcDocument.cloud_file_id == doc_in.cloud_file_id).first()
    
    if not existing_doc and doc_in.file_url:
        existing_doc = query.filter(IpcDocument.file_url == doc_in.file_url).first()

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
            department="ipc",
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
    
    if hasattr(IpcDocument, 'project_id'):
        kwargs["project_id"] = project_id
    if hasattr(IpcDocument, 'contract_id'):
        kwargs["contract_id"] = contract_id
    if hasattr(IpcDocument, 'cloud_file_id'):
        kwargs["cloud_file_id"] = doc_in.cloud_file_id
    if hasattr(IpcDocument, 'file_size'):
        kwargs["file_size"] = doc_in.file_size
    if hasattr(IpcDocument, 'is_linked'):
        kwargs["is_linked"] = True
        kwargs["linked_at"] = func.now()

    new_doc = IpcDocument(**kwargs)
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
        department="ipc",
        file_size=getattr(d, 'file_size', 0),
        cloud_file_id=getattr(d, 'cloud_file_id', None),
        origin=d.origin or "file_upload",
        integration_id=d.integration_id,
        is_linked=getattr(d, 'is_linked', True),
        linked_at=getattr(d, 'linked_at', None),
        unlinked_at=getattr(d, 'unlinked_at', None),
        created_at=getattr(d, 'created_at', None)
    )

@router.delete("/{document_id}")
def delete_ipc_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db)
):
    doc = db.query(IpcDocument).filter(IpcDocument.id == document_id).first()
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
    else:
        db.delete(doc)
        db.commit()
        return {"status": "deleted"}

# --- IPC Record Endpoints ---

from ..models.ipc import IPC

@router.get("/records", response_model=List[platform_schemas.IPC])
def get_ipcs(
    project_id: int,
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(IPC).filter(IPC.project_id == project_id)
    if contract_id:
        query = query.filter(IPC.contract_id == contract_id)
    ipcs = query.order_by(IPC.certificate_number).all()
    return ipcs

@router.post("/records", response_model=platform_schemas.IPC)
def create_ipc(
    project_id: int,
    ipc_in: platform_schemas.IPCCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_ipc = IPC(
        project_id=project_id,
        contract_id=ipc_in.contract_id,
        certificate_number=ipc_in.certificate_number,
        period_start=ipc_in.period_start,
        period_end=ipc_in.period_end,
        valuation_date=ipc_in.valuation_date,
        gross_amount_claimed=ipc_in.gross_amount_claimed,
        gross_amount_certified=ipc_in.gross_amount_certified,
        total_deductions=ipc_in.total_deductions,
        net_amount_due=ipc_in.net_amount_due,
        cumulative_certified=ipc_in.cumulative_certified,
        status=ipc_in.status,
        payment_status=ipc_in.payment_status,
        unpaid_amount=ipc_in.unpaid_amount,
        payment_date=ipc_in.payment_date,
        payment_reference=ipc_in.payment_reference,
        values_map=ipc_in.values_map
    )
    db.add(new_ipc)
    db.commit()
    db.refresh(new_ipc)
    return new_ipc

@router.put("/records/{ipc_id}", response_model=platform_schemas.IPC)
def update_ipc(
    project_id: int,
    ipc_id: int,
    ipc_in: platform_schemas.IPCUpdate,
    db: Session = Depends(get_db)
):
    ipc = db.query(IPC).filter(IPC.id == ipc_id, IPC.project_id == project_id).first()
    if not ipc:
        raise HTTPException(status_code=404, detail="IPC not found")

    update_data = ipc_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ipc, key, value)
        
    db.commit()
    db.refresh(ipc)
    return ipc

@router.get("/summary")
def get_ipc_summary(
    project_id: int,
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    # Calculate dashboard metrics
    query = db.query(IPC).filter(IPC.project_id == project_id)
    if contract_id:
        query = query.filter(IPC.contract_id == contract_id)
        
    ipcs = query.all()
    
    total_certified = sum(ipc.net_amount_due for ipc in ipcs if ipc.net_amount_due and ipc.status in ['Certified', 'Paid'])
    total_unpaid = sum(ipc.unpaid_amount for ipc in ipcs if ipc.unpaid_amount and ipc.payment_status != 'PAID')
    pending_claims = sum(ipc.gross_amount_claimed for ipc in ipcs if ipc.gross_amount_claimed and ipc.status in ['Draft', 'Submitted'])
    
    return {
        "total_certified": total_certified,
        "total_outstanding_unpaid": total_unpaid,
        "pending_claims": pending_claims,
        "ipcs_count": len(ipcs)
    }
