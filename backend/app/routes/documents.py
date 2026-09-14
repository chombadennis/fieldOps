from fastapi import APIRouter, Depends, HTTPException, Query
import logging

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import database
from ..models.document import Document
from ..models.project import Project
from ..models.contract import Contract
from ..models.project_integration import ProjectIntegration
from ..schemas import platform as platform_schemas
from .users import get_current_user
from ..models.user import User

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

from sqlalchemy.sql import func

@router.get("/projects/{project_id}/documents", response_model=List[platform_schemas.Document])
def get_project_documents(
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
        # Fallback to general contract
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract:
            contract_id = general_contract.id

    query = db.query(Document).filter(Document.project_id == project_id, Document.is_linked == True)
    if contract_id is not None:
        query = query.filter(Document.contract_id == contract_id)
    if department and department != "All":
        query = query.filter(Document.department == department)

    docs = query.order_by(Document.created_at.desc()).all()
    return docs

@router.post("/projects/{project_id}/documents", response_model=platform_schemas.Document)
def create_project_document(
    project_id: int,
    doc_in: platform_schemas.DocumentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from ..models.contract import Contract
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

    # Prevent duplicates: check if this file was already linked before under this contract
    existing_doc = None
    if doc_in.cloud_file_id:
        existing_doc = db.query(Document).filter(
            Document.project_id == project_id,
            Document.contract_id == contract_id,
            Document.cloud_file_id == doc_in.cloud_file_id
        ).first()
    
    if not existing_doc and doc_in.file_url:
        existing_doc = db.query(Document).filter(
            Document.project_id == project_id,
            Document.contract_id == contract_id,
            Document.file_url == doc_in.file_url
        ).first()

    if existing_doc:
        # Reactivate/update existing document metadata
        existing_doc.name = doc_in.title
        existing_doc.file_url = doc_in.file_url
        existing_doc.file_type = doc_in.file_type
        existing_doc.department = doc_in.department
        existing_doc.file_size = doc_in.file_size
        if doc_in.integration_id:
            existing_doc.integration_id = doc_in.integration_id
        existing_doc.uploaded_by = current_user.id
        existing_doc.is_linked = True
        existing_doc.linked_at = func.now()
        existing_doc.unlinked_at = None
        db.commit()
        db.refresh(existing_doc)
        return existing_doc

    new_doc = Document(
        project_id=project_id,
        contract_id=contract_id,
        note_id=doc_in.note_id,
        name=doc_in.title,
        file_url=doc_in.file_url,
        file_type=doc_in.file_type,
        department=doc_in.department,
        file_size=doc_in.file_size,
        cloud_file_id=doc_in.cloud_file_id,
        origin=doc_in.origin or "file_upload",
        integration_id=doc_in.integration_id,
        uploaded_by=current_user.id,
        is_linked=True,
        linked_at=func.now(),
        supersedes_id=doc_in.supersedes_id,
        revision_label=doc_in.revision_label
    )
    db.add(new_doc)
    db.commit()
    
    # Auto-archive the superseded document
    if doc_in.supersedes_id:
        old_doc = db.query(Document).filter(Document.id == doc_in.supersedes_id).first()
        if old_doc:
            old_doc.is_archived = True
            db.commit()
    db.refresh(new_doc)
    return new_doc

@router.post("/projects/{project_id}/documents/{document_id}/unlink", response_model=platform_schemas.Document)
def unlink_project_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    doc = db.query(Document).filter(Document.id == document_id, Document.project_id == project_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.is_linked = False
    doc.unlinked_at = func.now()
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/projects/{project_id}/documents/{document_id}")
def delete_project_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    doc = db.query(Document).filter(Document.id == document_id, Document.project_id == project_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete integration connection if attached to an integration
    if doc.integration_id:
        from ..models.project_integration import ProjectIntegration
        db.query(ProjectIntegration).filter(ProjectIntegration.id == doc.integration_id).delete(synchronize_session=False)

    # Permanently delete document from database
    db.delete(doc)
    db.commit()
    return {"status": "deleted", "message": f"Document '{doc.name}' integration and document permanently deleted from database."}


@router.get("/documents/{document_id}/embed-url")
async def get_document_embed_url(
    document_id: int,
    mode: str = "view",
    doc_type: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Generate a safe embeddable URL for a linked cloud document using the
    OAuth tokens stored in its associated project_integration record.
    Works for both Google Drive and OneDrive documents.
    """
    if doc_type == "ipc":
        from ..models.ipc_document import IpcDocument
        doc = db.query(IpcDocument).filter(IpcDocument.id == document_id).first()
    elif doc_type == "budget":
        from ..models.budget_document import BudgetDocument
        doc = db.query(BudgetDocument).filter(BudgetDocument.id == document_id).first()
    elif doc_type == "boq":
        from ..models.boq_document import BoqDocument
        doc = db.query(BoqDocument).filter(BoqDocument.id == document_id).first()
    elif doc_type == "field_ops":
        from ..models.field_ops import FieldOpsDocument
        doc = db.query(FieldOpsDocument).filter(FieldOpsDocument.id == document_id).first()
    else:
        doc = db.query(Document).filter(Document.id == document_id).first()
        
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    integration = None
    if getattr(doc, "integration_id", None):
        integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == doc.integration_id).first()

    # Auto-heal legacy documents created before integration_id was stored
    if not integration:
        cloud_file_id = getattr(doc, "cloud_file_id", None)
        project_id = getattr(doc, "project_id", None)
        if not project_id and hasattr(doc, "budget") and doc.budget:
            project_id = doc.budget.project_id
        if not project_id and hasattr(doc, "project") and doc.project:
            project_id = doc.project.id
            
        if cloud_file_id and project_id:
            integration = db.query(ProjectIntegration).filter(
                ProjectIntegration.project_id == project_id,
                ProjectIntegration.spreadsheet_id == cloud_file_id
            ).first()
        if not integration and project_id:
            origin = getattr(doc, "origin", None)
            provider = "onedrive" if origin in ["onedrive", "microsoft"] else "google_sheets"
            integration = db.query(ProjectIntegration).filter(
                ProjectIntegration.project_id == project_id,
                ProjectIntegration.provider == provider
            ).order_by(ProjectIntegration.id.desc()).first()

        # Persist healed integration_id for future fast lookups
        if integration and hasattr(doc, "integration_id"):
            doc.integration_id = integration.id
            db.commit()
            db.refresh(doc)

    if not integration:
        # Fallback for Google Drive files without active integration record
        file_id = getattr(doc, "cloud_file_id", None)
        file_url = getattr(doc, "file_url", None)
        origin = getattr(doc, "origin", None)
        file_type = getattr(doc, "file_type", None)
        if not file_id and file_url:
            import re
            match = re.search(r'(?:file/d/|id=)([a-zA-Z0-9_-]+)', file_url)
            if match:
                file_id = match.group(1)
        if file_id and (origin == "google" or "google.com" in getattr(doc, "file_url", "") or not origin):
            title = getattr(doc, "title", getattr(doc, "name", ""))
            is_sheet = file_type == "Cloud File" or (title and any(title.lower().endswith(ext) for ext in [".xlsx", ".xls", ".csv", ".ods", ".gsheet"]))
            if is_sheet:
                return {"url": f"https://docs.google.com/spreadsheets/d/{file_id}/preview", "provider": "google"}
            else:
                return {"url": f"https://drive.google.com/file/d/{file_id}/preview", "provider": "google"}

        raise HTTPException(
            status_code=400,
            detail="No active cloud integration found for this document."
        )

    try:
        from ..utils.security import decrypt_token
        decrypted = decrypt_token(integration.refresh_token)

        if integration.provider == "google_sheets":
            from ..services.integrations.embed_service import get_google_embed_url
            title = getattr(doc, "title", getattr(doc, "name", ""))
            file_type = getattr(doc, "file_type", None)
            is_sheet = file_type == "Cloud File" or (title and any(title.lower().endswith(ext) for ext in [".xlsx", ".xls", ".csv", ".ods", ".gsheet"]))
            cloud_file_id = getattr(doc, "cloud_file_id", None)
            embed_url = await get_google_embed_url(cloud_file_id or integration.spreadsheet_id, mode, is_sheet=is_sheet)
            return {"url": embed_url, "provider": "google"}

        elif integration.provider == "onedrive":
            import httpx
            from ..services.integrations.onedrive import refresh_onedrive_access_token
            from ..services.integrations.embed_service import get_onedrive_embed_url

            access_token = await refresh_onedrive_access_token(decrypted)

            # Get webUrl from Microsoft Graph using cloud_file_id
            cloud_file_id = getattr(doc, "cloud_file_id", None)
            file_id = cloud_file_id or integration.spreadsheet_id
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{file_id}?select=webUrl"
            headers = {"Authorization": f"Bearer {access_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=resp.status_code,
                        detail=f"Microsoft Graph API error: {resp.text}"
                    )
                web_url = resp.json().get("webUrl")
                if not web_url:
                    raise HTTPException(status_code=500, detail="No webUrl found for this file in Microsoft Graph.")

            is_office = True
            title = getattr(doc, "title", getattr(doc, "name", ""))
            title_lower = title.lower() if title else ""
            file_type = getattr(doc, "file_type", None)
            file_type_lower = file_type.lower() if file_type else ""
            
            # Default to Office format unless explicitly a PDF, 
            # to handle Office files that might not have extensions in their title.
            if title_lower.endswith(".pdf") or file_type_lower == "pdf":
                is_office = False

            if is_office:
                embed_url = await get_onedrive_embed_url(web_url, mode, is_office=True)
            else:
                import os
                api_base = os.environ.get("VITE_API_URL", "http://localhost:8000")
                embed_url = f"{api_base}/api/documents/{doc.id}/stream"
                if doc_type:
                    embed_url += f"?doc_type={doc_type}"
                
            return {"url": embed_url, "provider": "onedrive"}

        else:
            raise HTTPException(status_code=400, detail="Unsupported provider.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Note attachment retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/migrate-boqs")
async def migrate_boqs(db: Session = Depends(get_db)):
    from ..models.boq_document import BoqDocument
    boqs = db.query(BoqDocument).all()
    created = 0
    for boq in boqs:
        doc = db.query(Document).filter(Document.metadata_map.contains({"boq_id": boq.id})).first()
        if not doc:
            doc = Document(
                project_id=boq.project_id,
                contract_id=boq.contract_id,
                name=boq.name,
                origin=boq.origin,
                department="boq",
                integration_id=boq.integration_id,
                metadata_map={"boq_id": boq.id}
            )
            db.add(doc)
            created += 1
    db.commit()
    return {"created": created}


@router.get("/documents/{document_id}/stream")
async def stream_project_document(
    document_id: int,
    doc_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Streams the raw binary content of a cloud document (PDF, Word, etc.)
    directly to the browser using stored OAuth access tokens.
    Bypasses third-party cookie restrictions in iframes.
    """
    from fastapi.responses import Response
    import httpx

    if doc_type == "ipc":
        from ..models.ipc_document import IpcDocument
        doc = db.query(IpcDocument).filter(IpcDocument.id == document_id).first()
    elif doc_type == "budget":
        from ..models.budget_document import BudgetDocument
        doc = db.query(BudgetDocument).filter(BudgetDocument.id == document_id).first()
    elif doc_type == "boq":
        from ..models.boq_document import BoqDocument
        doc = db.query(BoqDocument).filter(BoqDocument.id == document_id).first()
    elif doc_type == "field_ops":
        from ..models.field_ops import FieldOpsDocument
        doc = db.query(FieldOpsDocument).filter(FieldOpsDocument.id == document_id).first()
    else:
        doc = db.query(Document).filter(Document.id == document_id).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    integration = None
    if getattr(doc, "integration_id", None):
        integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == doc.integration_id).first()

    cloud_file_id = getattr(doc, "cloud_file_id", None)
    project_id = getattr(doc, "project_id", None)
    if not project_id and hasattr(doc, "budget") and doc.budget:
        project_id = doc.budget.project_id
    if not project_id and hasattr(doc, "project") and doc.project:
        project_id = doc.project.id

    if not integration and cloud_file_id and project_id:
        integration = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.spreadsheet_id == cloud_file_id
        ).first()

    if not integration and project_id:
        origin = getattr(doc, "origin", None)
        provider = "onedrive" if (origin and origin in ["onedrive", "microsoft"]) else "google_sheets"
        integration = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.provider == provider
        ).order_by(ProjectIntegration.id.desc()).first()

    if not integration:
        raise HTTPException(
            status_code=400,
            detail="No active cloud integration found to authorize document stream."
        )

    file_id = cloud_file_id or integration.spreadsheet_id
    if not file_id:
        raise HTTPException(status_code=400, detail="Cloud file ID not found for document.")

    title = getattr(doc, "title", getattr(doc, "name", "Document"))

    from ..utils.security import decrypt_token
    decrypted = decrypt_token(integration.refresh_token)

    if integration.provider == "google_sheets":
        from ..services.integrations.google_sheets import refresh_google_access_token
        access_token = await refresh_google_access_token(decrypted)

        url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Google Drive API error: {resp.text}")

            content_type = resp.headers.get("content-type", "application/pdf")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'inline; filename="{title}"',
                    "Cache-Control": "private, max-age=3600"
                }
            )

    elif integration.provider == "onedrive":
        from ..services.integrations.onedrive import refresh_onedrive_access_token
        access_token = await refresh_onedrive_access_token(decrypted)

        url = f"https://graph.microsoft.com/v1.0/me/drive/items/{file_id}/content"
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, follow_redirects=True)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Microsoft Graph API error: {resp.text}")

            content_type = resp.headers.get("content-type", "application/pdf")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'inline; filename="{title}"',
                    "Cache-Control": "private, max-age=3600"
                }
            )
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider for streaming.")

@router.patch("/projects/{project_id}/documents/{document_id}", response_model=platform_schemas.Document)
def update_project_document(
    project_id: int,
    document_id: int,
    doc_update: platform_schemas.DocumentUpdate,
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id, Document.project_id == project_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if doc_update.extracted_data is not None:
        doc.extracted_data = doc_update.extracted_data
    if doc_update.context_description is not None:
        doc.context_description = doc_update.context_description
    if doc_update.link_reason is not None:
        doc.link_reason = doc_update.link_reason
    if doc_update.review_requested_from is not None:
        doc.review_requested_from = doc_update.review_requested_from
    if doc_update.supersedes_id is not None:
        doc.supersedes_id = doc_update.supersedes_id
        # Automatically mark the old document as archived when superseded
        old_doc = db.query(Document).filter(Document.id == doc_update.supersedes_id).first()
        if old_doc:
            old_doc.is_archived = True
    if doc_update.revision_label is not None:
        doc.revision_label = doc_update.revision_label
    if doc_update.is_archived is not None:
        doc.is_archived = doc_update.is_archived
    
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/projects/{project_id}/documents/all", response_model=List[platform_schemas.Document])
def get_all_project_documents(
    project_id: int,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from ..models.project_integration import ProjectIntegration
    
    # Pre-fetch integrations to avoid N+1 and get emails
    integrations = db.query(ProjectIntegration).filter(ProjectIntegration.project_id == project_id).all()
    integration_map = {i.id: i for i in integrations}
    
    def process_docs(docs, dept=None):
        result = []
        for d in docs:
            uploaded_by = None
            cloud_email = None
            if d.integration_id and d.integration_id in integration_map:
                integration = integration_map[d.integration_id]
                uploaded_by = integration.user_id
                if integration.meta_data:
                    cloud_email = integration.meta_data.get('cloud_email')
            
            # Use getattr for department just in case
            doc_dept = getattr(d, 'department', dept)
            
            result.append(
                platform_schemas.Document(
                    id=d.id,
                    project_id=d.project_id,
                    contract_id=d.contract_id,
                    title=d.name,
                    file_url=d.file_url or "",
                    file_type=d.file_type or "pdf",
                    department=doc_dept,
                    file_size=d.file_size or 0,
                    cloud_file_id=d.cloud_file_id,
                    origin=d.origin or "file_upload",
                    integration_id=d.integration_id,
                    extracted_data=getattr(d, 'metadata_map', None) or getattr(d, 'extracted_data', None),
                    is_linked=d.is_linked,
                    linked_at=d.linked_at,
                    unlinked_at=d.unlinked_at,
                    created_at=getattr(d, 'created_at', None),
                    uploaded_by=getattr(d, 'uploaded_by', uploaded_by),
                    cloud_email=cloud_email
                )
            )
        return result

    all_docs = []

    # 1. Standard Documents
    query_docs = db.query(Document).filter(Document.project_id == project_id, Document.is_linked == True).order_by(Document.created_at.desc()).all()
    all_docs.extend(process_docs(query_docs))

    # 2. Tech
    try:
        from ..models.tech import TechDocument
        tech_docs = db.query(TechDocument).filter(TechDocument.project_id == project_id).all()
        all_docs.extend(process_docs(tech_docs, 'Tech'))
    except ImportError: pass

    # 3. Field Ops
    try:
        from ..models.field_ops import FieldOpsDocument
        fo_docs = db.query(FieldOpsDocument).filter(FieldOpsDocument.project_id == project_id).all()
        all_docs.extend(process_docs(fo_docs, 'Field Operations'))
    except ImportError: pass

    # 4. Activity Schedule
    try:
        from ..models.activity_schedule import ActivityScheduleDocument
        as_docs = db.query(ActivityScheduleDocument).filter(ActivityScheduleDocument.project_id == project_id).all()
        all_docs.extend(process_docs(as_docs, 'Activity Schedule'))
    except ImportError: pass

    # 5. Milestone Claims
    try:
        from ..models.milestone_claims import MilestoneClaimDocument
        mc_docs = db.query(MilestoneClaimDocument).filter(MilestoneClaimDocument.project_id == project_id).all()
        all_docs.extend(process_docs(mc_docs, 'Milestone Claims'))
    except ImportError: pass

    # 6. Rate Schedule
    try:
        from ..models.rate_schedule import RateScheduleDocument
        rs_docs = db.query(RateScheduleDocument).filter(RateScheduleDocument.project_id == project_id).all()
        all_docs.extend(process_docs(rs_docs, 'Rate Schedule'))
    except ImportError: pass

    # 7. Reimbursable Claims
    try:
        from ..models.reimbursable_claims import ReimbursableClaimDocument
        rc_docs = db.query(ReimbursableClaimDocument).filter(ReimbursableClaimDocument.project_id == project_id).all()
        all_docs.extend(process_docs(rc_docs, 'Reimbursable Claims'))
    except ImportError: pass

    # 8. Program of Works
    try:
        from ..models.program_of_works import ProgramOfWorksDocument
        pow_docs = db.query(ProgramOfWorksDocument).filter(ProgramOfWorksDocument.project_id == project_id).all()
        all_docs.extend(process_docs(pow_docs, 'Program of Works'))
    except ImportError: pass

    # 9. IPC
    try:
        from ..models.ipc_document import IpcDocument
        ipc_docs = db.query(IpcDocument).filter(IpcDocument.project_id == project_id).all()
        all_docs.extend(process_docs(ipc_docs, 'IPC'))
    except ImportError: pass

    all_docs.sort(key=lambda d: d.created_at.timestamp() if getattr(d, 'created_at', None) else 0, reverse=True)
    return all_docs

@router.post("/projects/{project_id}/documents/{document_id}/analyze", response_model=platform_schemas.Document)
def analyze_project_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trigger the 'Nine Questions' AI analysis for a linked document.
    This simulates an LLM call to extract standard project management insights from the document.
    """
    doc = db.query(Document).filter(Document.id == document_id, Document.project_id == project_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    simulated_insights = {
        "What is the main topic?": f"Analysis of {doc.name or doc.title}",
        "Who is responsible?": "Pending assignment",
        "What are the blockers?": "None identified in the document text",
        "Is there a cost impact?": "Requires further review",
        "What is the deadline?": "Not explicitly stated",
        "What are the next steps?": "Review and approve the document",
        "Are there any compliance issues?": "Appears compliant with standard policies",
        "What departments are involved?": doc.department or "General",
        "Overall Summary": f"This is an automated AI summary of {doc.file_type} document '{doc.name}'."
    }

    doc.ai_insights = simulated_insights
    db.commit()
    db.refresh(doc)
    
    return doc
