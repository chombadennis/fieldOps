from fastapi import APIRouter, Depends, HTTPException, Query
import logging

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import database
from ..models.document import Document
from ..models.project import Project
from ..models.project_integration import ProjectIntegration
from ..schemas import platform as platform_schemas

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

    return query.order_by(Document.created_at.desc()).all()

@router.post("/projects/{project_id}/documents", response_model=platform_schemas.Document)
def create_project_document(
    project_id: int,
    doc_in: platform_schemas.DocumentCreate,
    db: Session = Depends(get_db)
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
        is_linked=True,
        linked_at=func.now()
    )
    db.add(new_doc)
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

    # Unlink first
    doc.is_linked = False
    doc.unlinked_at = func.now()
    db.commit()

    # Permanently delete document from database
    db.delete(doc)
    db.commit()
    return {"status": "deleted", "message": f"Document '{doc.name}' unlinked and permanently deleted from database."}


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
    else:
        doc = db.query(Document).filter(Document.id == document_id).first()
        
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    integration = None
    if doc.integration_id:
        integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == doc.integration_id).first()

    # Auto-heal legacy documents created before integration_id was stored
    if not integration:
        if doc.cloud_file_id:
            integration = db.query(ProjectIntegration).filter(
                ProjectIntegration.project_id == doc.project_id,
                ProjectIntegration.spreadsheet_id == doc.cloud_file_id
            ).first()
        if not integration:
            provider = "onedrive" if doc.origin in ["onedrive", "microsoft"] else "google_sheets"
            integration = db.query(ProjectIntegration).filter(
                ProjectIntegration.project_id == doc.project_id,
                ProjectIntegration.provider == provider
            ).order_by(ProjectIntegration.id.desc()).first()

        # Persist healed integration_id for future fast lookups
        if integration:
            doc.integration_id = integration.id
            db.commit()
            db.refresh(doc)

    if not integration:
        # Fallback for Google Drive files without active integration record
        file_id = doc.cloud_file_id
        if not file_id and doc.file_url:
            import re
            match = re.search(r'(?:file/d/|id=)([a-zA-Z0-9_-]+)', doc.file_url)
            if match:
                file_id = match.group(1)
        if file_id and (doc.origin == "google" or "google.com" in getattr(doc, "file_url", "") or not doc.origin):
            title = getattr(doc, "title", getattr(doc, "name", ""))
            is_sheet = doc.file_type == "Cloud File" or (title and any(title.lower().endswith(ext) for ext in [".xlsx", ".xls", ".csv", ".ods", ".gsheet"]))
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
            is_sheet = doc.file_type == "Cloud File" or (title and any(title.lower().endswith(ext) for ext in [".xlsx", ".xls", ".csv", ".ods", ".gsheet"]))
            embed_url = await get_google_embed_url(doc.cloud_file_id or integration.spreadsheet_id, mode, is_sheet=is_sheet)
            return {"url": embed_url, "provider": "google"}

        elif integration.provider == "onedrive":
            import httpx
            from ..services.integrations.onedrive import refresh_onedrive_access_token
            from ..services.integrations.embed_service import get_onedrive_embed_url

            access_token = await refresh_onedrive_access_token(decrypted)

            # Get webUrl from Microsoft Graph using cloud_file_id
            file_id = doc.cloud_file_id or integration.spreadsheet_id
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
            file_type_lower = doc.file_type.lower() if doc.file_type else ""
            
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
                
            return {"url": embed_url, "provider": "onedrive"}

        else:
            raise HTTPException(status_code=400, detail="Unsupported provider.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating document embed URL: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embed URL: {str(e)}")


@router.get("/documents/{document_id}/stream")
async def stream_project_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    Streams the raw binary content of a cloud document (PDF, Word, etc.)
    directly to the browser using stored OAuth access tokens.
    Bypasses third-party cookie restrictions in iframes.
    """
    from fastapi.responses import Response
    import httpx

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    integration = None
    if doc.integration_id:
        integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == doc.integration_id).first()

    if not integration and doc.cloud_file_id:
        integration = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == doc.project_id,
            ProjectIntegration.spreadsheet_id == doc.cloud_file_id
        ).first()

    if not integration:
        provider = "onedrive" if (doc.origin and doc.origin in ["onedrive", "microsoft"]) else "google_sheets"
        integration = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == doc.project_id,
            ProjectIntegration.provider == provider
        ).order_by(ProjectIntegration.id.desc()).first()

    if not integration:
        raise HTTPException(
            status_code=400,
            detail="No active cloud integration found to authorize document stream."
        )

    file_id = doc.cloud_file_id or integration.spreadsheet_id
    if not file_id:
        raise HTTPException(status_code=400, detail="Cloud file ID not found for document.")

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
                    "Content-Disposition": f'inline; filename="{doc.title}"',
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
                    "Content-Disposition": f'inline; filename="{doc.title}"',
                    "Cache-Control": "private, max-age=3600"
                }
            )
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider for streaming.")
