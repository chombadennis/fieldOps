import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Query
from fastapi.responses import RedirectResponse, PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from ..core.config import settings
from ..db.database import get_db
from ..models.project_integration import ProjectIntegration
from ..models.project import Project
from ..models.ipc import IPC
from ..utils.security import encrypt_token, decrypt_token
from ..services.integrations import (
    get_google_auth_url,
    exchange_google_code_for_tokens,
    refresh_google_access_token,
    get_onedrive_auth_url,
    exchange_onedrive_code_for_tokens,
    refresh_onedrive_access_token,
    run_initial_import,
    get_google_spreadsheet_sheets,
    get_onedrive_sheets,
    get_google_sheet_rows,
    get_onedrive_sheet_rows,
    process_sheet_webhook_update
)
from ..services.integrations.ipc_ai_engine import process_ipc_with_ai
from ..services.integrations.budget_ai_engine import process_budget_with_ai

logger = logging.getLogger(__name__)

router = APIRouter()

class LinkRequest(BaseModel):
    project_id: int
    provider: str  # 'google_sheets' or 'onedrive'
    spreadsheet_id: str
    sheet_name: str = "Sheet1"
    boq_name: Optional[str] = None

class SyncRequest(BaseModel):
    provider: str
    spreadsheet_id: str
    sheet_name: str
    changes: List[Dict[str, Any]]

class IpcPreviewRequest(BaseModel):
    project_id: int
    provider: str
    spreadsheet_id: str
    ipc_certificate_number: str
    refresh_token: Optional[str] = None

class BudgetPreviewRequest(BaseModel):
    project_id: int
    provider: str
    spreadsheet_id: str
    refresh_token: Optional[str] = None
    selected_sheets: Optional[List[str]] = None
    tracking_mode: Optional[str] = "split"
    trade_label: Optional[str] = None

class BudgetCommitRequest(BaseModel):
    project_id: int
    contract_id: Optional[int] = None
    original_contract_sum: float
    appraised_budget: Optional[float] = None
    earned_value: float = 0.0
    remaining_balance: float = 0.0
    percent_used: float = 0.0
    categories: List[Dict[str, Any]] = []
    integration_id: Optional[int] = None
    file_url: Optional[str] = None
    title: Optional[str] = "Master Budget & EVM"
    trade_label: Optional[str] = "General Trade"
    expected_count: Optional[int] = 1
    project_title_found: Optional[str] = None

# --- OAuth Authorization Redirect URLs ---

@router.get("/projects/{project_id}/integrations/token")
def get_global_integration_token(
    project_id: int, 
    provider: str,
    db: Session = Depends(get_db)
):
    """
    Checks if there's any existing valid refresh token for this project and provider, regardless of module.
    """
    integration = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == project_id,
        ProjectIntegration.provider == provider,
        ProjectIntegration.refresh_token.isnot(None)
    ).first()
    
    if integration:
        return {"has_auth": True, "refresh_token": integration.refresh_token}
    return {"has_auth": False}

@router.get("/integrations/google/auth-url")
def google_auth_url(project_id: int, active_tab: Optional[str] = None, pmo_sub_tab: Optional[str] = None):
    """
    Returns the Google Sheets OAuth consent URL for a specific project, encoding tab context in state.
    """
    state_str = str(project_id)
    if active_tab:
        state_str += f":{active_tab}"
        if pmo_sub_tab:
            state_str += f":{pmo_sub_tab}"
    url = get_google_auth_url(project_id, state_str)
    return {"url": url}

@router.get("/integrations/onedrive/auth-url")
def onedrive_auth_url(project_id: int, active_tab: Optional[str] = None, pmo_sub_tab: Optional[str] = None):
    """
    Returns the Microsoft Graph OAuth consent URL for a specific project, encoding tab context in state.
    """
    state_str = str(project_id)
    if active_tab:
        state_str += f":{active_tab}"
        if pmo_sub_tab:
            state_str += f":{pmo_sub_tab}"
    url = get_onedrive_auth_url(project_id, state_str)
    return {"url": url}

# --- OAuth Callbacks ---

@router.get("/integrations/google/callback")
async def google_callback(
    code: str,
    state: str,  # Contains project_id[:active_tab][:pmo_sub_tab]
    db: Session = Depends(get_db)
):
    """
    Handles Google OAuth redirect, exchanges code for refresh token, and redirects back to dashboard.
    """
    parts = state.split(":")
    try:
        project_id = int(parts[0])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid project_id state parameter.")
        
    active_tab = parts[1] if len(parts) > 1 else None
    pmo_sub_tab = parts[2] if len(parts) > 2 else None

    try:
        tokens = await exchange_google_code_for_tokens(code)
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            existing = db.query(ProjectIntegration).filter(
                ProjectIntegration.project_id == project_id,
                ProjectIntegration.provider == "google_sheets"
            ).first()
            if existing:
                refresh_token = existing.refresh_token
            else:
                raise HTTPException(
                    status_code=400,
                    detail="No refresh token returned. Go to your Google account security settings and revoke access to this application, then try again."
                )
        else:
            refresh_token = encrypt_token(refresh_token)
            
        frontend_url = f"{settings.FRONTEND_URL}/dashboard/{project_id}?oauth_provider=google_sheets&refresh_token={refresh_token}"
        if active_tab:
            frontend_url += f"&active_tab={active_tab}"
            if pmo_sub_tab:
                frontend_url += f"&pmo_sub_tab={pmo_sub_tab}"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logger.exception("Google OAuth Callback Failed:")
        err_frontend_url = f"{settings.FRONTEND_URL}/dashboard/{project_id}?error={str(e)}"
        if active_tab:
            err_frontend_url += f"&active_tab={active_tab}"
            if pmo_sub_tab:
                err_frontend_url += f"&pmo_sub_tab={pmo_sub_tab}"
        return RedirectResponse(url=err_frontend_url)

@router.get("/integrations/onedrive/callback")
async def onedrive_callback(
    code: str,
    state: str,  # Contains project_id[:active_tab][:pmo_sub_tab]
    db: Session = Depends(get_db)
):
    """
    Handles OneDrive OAuth redirect, exchanges code for refresh token, and redirects to dashboard.
    """
    parts = state.split(":")
    try:
        project_id = int(parts[0])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid project_id state parameter.")
        
    active_tab = parts[1] if len(parts) > 1 else None
    pmo_sub_tab = parts[2] if len(parts) > 2 else None

    try:
        tokens = await exchange_onedrive_code_for_tokens(code)
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            existing = db.query(ProjectIntegration).filter(
                ProjectIntegration.project_id == project_id,
                ProjectIntegration.provider == "onedrive"
            ).first()
            if existing:
                refresh_token = existing.refresh_token
            else:
                raise HTTPException(status_code=400, detail="No refresh token returned by Microsoft Graph OAuth API.")
        else:
            refresh_token = encrypt_token(refresh_token)
            
        frontend_url = f"{settings.FRONTEND_URL}/dashboard/{project_id}?oauth_provider=onedrive&refresh_token={refresh_token}"
        if active_tab:
            frontend_url += f"&active_tab={active_tab}"
            if pmo_sub_tab:
                frontend_url += f"&pmo_sub_tab={pmo_sub_tab}"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logger.exception("OneDrive OAuth Callback Failed:")
        err_frontend_url = f"{settings.FRONTEND_URL}/dashboard/{project_id}?error={str(e)}"
        if active_tab:
            err_frontend_url += f"&active_tab={active_tab}"
            if pmo_sub_tab:
                err_frontend_url += f"&pmo_sub_tab={pmo_sub_tab}"
        return RedirectResponse(url=err_frontend_url)


@router.get("/integrations/list-files")
async def list_cloud_files(
    provider: str,
    refresh_token: str,
    project_id: Optional[int] = Query(None),
    folder_id: Optional[str] = None,
    filter_type: Optional[str] = "spreadsheets",
    db: Session = Depends(get_db)
):
    """
    Given an encrypted refresh token and optional folder_id, fetches access token,
    and returns a list of subfolders and files inside that folder, filtered by type.
    """
    from ..utils.security import decrypt_token
    import httpx
    
    try:
        decrypted = decrypt_token(refresh_token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid encryption token.")
        
    rejected_map = {}
    active_linked_map = {}
    if project_id:
        rejected = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.provider == provider,
            ProjectIntegration.module == "budget_rejected"
        ).all()
        for r in rejected:
            rejected_map[r.spreadsheet_id] = r.meta_data.get("identified_document_type", "Unknown Document") if r.meta_data else "Unknown Document"

        active_integrations = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.module != "budget_rejected"
        ).all()
        for ai in active_integrations:
            active_linked_map[ai.spreadsheet_id] = ai.module.upper()

    if provider == "google_sheets":
        from ..services.integrations.google_sheets import refresh_google_access_token
        try:
            access_token = await refresh_google_access_token(decrypted)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to refresh Google token: {str(e)}")
            
        parent_id = folder_id if folder_id else "root"
        if filter_type == "all":
            q = f"'{parent_id}' in parents and trashed = false"
        else:
            q = (
                f"'{parent_id}' in parents and ("
                "mimeType='application/vnd.google-apps.folder' or "
                "mimeType='application/vnd.google-apps.spreadsheet' or "
                "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or "
                "mimeType='application/vnd.ms-excel'"
                ") and trashed = false"
            )
        
        # URL encode the query
        import urllib.parse
        encoded_q = urllib.parse.quote(q)
        url = f"https://www.googleapis.com/drive/v3/files?q={encoded_q}&fields=files(id,name,mimeType,webViewLink)"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Google Drive API error: {res.text}")
            files = res.json().get("files", [])
            
            mapped = []
            EXCLUDED_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.ico', '.heic', '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.mp3', '.wav', '.aac', '.flac', '.m4a')
            for f in files:
                mime_type = f.get("mimeType", "")
                name = f.get("name", "")
                is_folder = mime_type == "application/vnd.google-apps.folder"
                is_google_sheet = mime_type == "application/vnd.google-apps.spreadsheet"
                
                # Filter out image, video, and audio files
                if not is_folder:
                    if mime_type.startswith("image/") or mime_type.startswith("video/") or mime_type.startswith("audio/"):
                        continue
                    if name.lower().endswith(EXCLUDED_EXTENSIONS):
                        continue

                mapped.append({
                    "id": f["id"],
                    "name": name,
                    "type": "folder" if is_folder else "file",
                    "mime_type": mime_type,
                    "is_google_sheet": is_google_sheet,
                    "web_url": f.get("webViewLink"),
                    "is_rejected": f["id"] in rejected_map,
                    "rejected_reason": rejected_map.get(f["id"]),
                    "already_linked_module": active_linked_map.get(f["id"])
                })
            return mapped
            
    elif provider == "onedrive":
        from ..services.integrations.onedrive import refresh_onedrive_access_token
        try:
            access_token = await refresh_onedrive_access_token(decrypted)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to refresh Microsoft token: {str(e)}")
            
        if not folder_id or folder_id == "root":
            url = "https://graph.microsoft.com/v1.0/me/drive/root/children"
        else:
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{folder_id}/children"
            
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Microsoft Graph API error: {res.text}")
            items = res.json().get("value", [])
            
            files_list = []
            EXCLUDED_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.ico', '.heic', '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.mp3', '.wav', '.aac', '.flac', '.m4a')
            for item in items:
                is_folder = "folder" in item
                is_file = "file" in item
                name = item.get("name", "")
                web_url = item.get("webUrl")
                
                if is_folder:
                    files_list.append({
                        "id": item["id"],
                        "name": name,
                        "type": "folder",
                        "web_url": web_url
                    })
                else:
                    if name.lower().endswith(EXCLUDED_EXTENSIONS):
                        continue
                    is_spreadsheet = name.lower().endswith(".xlsx") or name.lower().endswith(".xls") or name.lower().endswith(".csv") or name.lower().endswith(".ods")
                    if filter_type == "all" or (is_file and is_spreadsheet):
                        files_list.append({
                            "id": item["id"],
                            "name": name,
                            "type": "file",
                            "web_url": web_url,
                            "is_rejected": item["id"] in rejected_map,
                            "rejected_reason": rejected_map.get(item["id"]),
                            "already_linked_module": active_linked_map.get(item["id"])
                        })
                
            return files_list
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider.")


@router.post("/integrations/convert-google-file")
async def convert_google_file(
    provider: str,
    refresh_token: str,
    file_id: str
):
    """
    Converts an Excel spreadsheet stored in Google Drive into native Google Sheets format.
    """
    if provider != "google_sheets":
        raise HTTPException(status_code=400, detail="Conversion is only supported for Google Drive files.")

    from ..utils.security import decrypt_token
    from ..services.integrations.google_sheets import refresh_google_access_token, convert_excel_to_google_sheet

    try:
        decrypted = decrypt_token(refresh_token)
        access_token = await refresh_google_access_token(decrypted)
        result = await convert_excel_to_google_sheet(file_id, access_token)
        return {
            "status": "success",
            "id": result.get("id"),
            "name": result.get("name"),
            "web_url": result.get("webViewLink")
        }
    except Exception as e:
        logger.error(f"Google file conversion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/list-sheets")
async def list_cloud_sheets(
    provider: str,
    refresh_token: str,
    spreadsheet_id: str,
    check_headers: bool = True
):
    """
    Retrieves the sheets in a spreadsheet.
    When check_headers=True (default, BoQ context), also fetches first rows and scans for BOQ column structure.
    When check_headers=False (IPC/Budget/Department), skips the header scan entirely for performance.
    """
    from ..utils.security import decrypt_token
    
    try:
        decrypted = decrypt_token(refresh_token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid encryption token.")
        
    if provider == "google_sheets":
        from ..services.integrations import (
            refresh_google_access_token,
            get_google_spreadsheet_sheets,
            get_google_sheets_batch_first_rows
        )
        try:
            access_token = await refresh_google_access_token(decrypted)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to refresh Google token: {str(e)}")
            
        try:
            sheets = await get_google_spreadsheet_sheets(spreadsheet_id, access_token)
        except Exception as e:
            err_msg = str(e).lower()
            if "must not be an office file" in err_msg or "failed_precondition" in err_msg or "invalid_argument" in err_msg or "invalid argument" in err_msg:
                raise HTTPException(
                    status_code=400,
                    detail="This is a raw file (e.g. CSV or Excel) stored in Google Drive, which Google Sheets cannot read directly. To resolve this: open the file in Google Drive on the web, click 'File' > 'Save as Google Sheets', and select the newly created Google Sheets file in FieldOps."
                )
            raise HTTPException(status_code=500, detail=f"Failed to fetch worksheets: {str(e)}")

        if check_headers:
            from ..services.integrations.sync_service import auto_map_columns
            sheet_names = [s["name"] for s in sheets]
            rows_dict = await get_google_sheets_batch_first_rows(spreadsheet_id, sheet_names, access_token)
            for s in sheets:
                rows = rows_dict.get(s["name"], [])
                header_idx, _ = auto_map_columns(rows)
                s["has_headers"] = header_idx != -1
        else:
            for s in sheets:
                s["has_headers"] = False
            
        return sheets
        
    elif provider == "onedrive":
        from ..services.integrations import (
            refresh_onedrive_access_token,
            get_onedrive_sheets,
            get_onedrive_sheets_first_rows
        )
        try:
            access_token = await refresh_onedrive_access_token(decrypted)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to refresh Microsoft token: {str(e)}")
            
        try:
            sheets = await get_onedrive_sheets(spreadsheet_id, access_token)
        except Exception as e:
            err_msg = str(e).lower()
            if "itemnotfound" in err_msg or "badrequest" in err_msg or "onedrive sheets fetch error" in err_msg:
                raise HTTPException(
                    status_code=400,
                    detail="Microsoft OneDrive integration can only read native Excel Workbooks (.xlsx). The file you selected (e.g. CSV) is not supported. Please open the file in OneDrive, click 'File' > 'Save As' > 'Download a Copy' (or convert it online), ensure it is saved as an Excel Workbook (.xlsx) in your Drive, and then select the new file."
                )
            raise HTTPException(status_code=500, detail=f"Failed to fetch OneDrive worksheets: {str(e)}")

        if check_headers:
            from ..services.integrations.sync_service import auto_map_columns
            sheet_names = [s["name"] for s in sheets]
            rows_dict = await get_onedrive_sheets_first_rows(spreadsheet_id, sheet_names, access_token)
            for s in sheets:
                rows = rows_dict.get(s["name"], [])
                header_idx, _ = auto_map_columns(rows)
                s["has_headers"] = header_idx != -1
        else:
            for s in sheets:
                s["has_headers"] = False
            
        return sheets
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider.")


# --- Setup spreadsheet links ---

@router.post("/integrations/link")
def link_spreadsheet_to_project(req: LinkRequest, db: Session = Depends(get_db)):
    """
    Links a spreadsheet ID and worksheet name to a project, creating or updating the ProjectIntegration.
    """
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    # Check if this integration already exists or check headers passed
    # If the user passed token via query/body or we fetch it:
    # Here we assume token is fetched from query string or re-saved
    # (frontend sends back the refresh_token it received in callback query params)
    pass

@router.post("/integrations/save")
def save_integration(
    project_id: int,
    provider: str,
    spreadsheet_id: str,
    sheet_name: str,
    contract_id: Optional[int] = Query(None),
    refresh_token: Optional[str] = Query(None),
    boq_name: Optional[str] = Query(None),
    module: Optional[str] = Query("boq"),
    trade_label: Optional[str] = Query(None),
    tracking_mode: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Saves or updates a ProjectIntegration record.
    """
    from ..models.contract import Contract

    # Validate or Default Contract ID
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail=f"Contract with ID {contract_id} does not belong to Project {project_id}.")
    else:
        contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if not contract:
            contract = Contract(project_id=project_id, name="General Contract", contract_type="GENERAL")
            db.add(contract)
            db.commit()
            db.refresh(contract)
        contract_id = contract.id

    existing_other = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == project_id,
        ProjectIntegration.spreadsheet_id == spreadsheet_id,
        ProjectIntegration.module != "budget_rejected"
    ).first()
    if existing_other and (module is None or existing_other.module != module):
        raise HTTPException(
            status_code=400,
            detail=f"This document is already linked under the {existing_other.module.upper()} tab for this project. Duplicate linkages are strictly prohibited."
        )

    existing = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == project_id,
        ProjectIntegration.contract_id == contract_id,
        ProjectIntegration.provider == provider,
        ProjectIntegration.spreadsheet_id == spreadsheet_id
    ).first()
    
    if not existing and not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required for new integrations.")
        
    meta_data = {}
    if trade_label is not None:
        meta_data["trade_label"] = trade_label
    if tracking_mode is not None:
        meta_data["tracking_mode"] = tracking_mode

    if existing:
        existing.spreadsheet_id = spreadsheet_id
        existing.sheet_name = sheet_name
        if boq_name is not None:
            existing.boq_name = boq_name
        if refresh_token:
            existing.refresh_token = refresh_token
        if module:
            existing.module = module
        if meta_data:
            existing.meta_data = meta_data
        db_integration = existing
    else:
        db_integration = ProjectIntegration(
            project_id=project_id,
            contract_id=contract_id,
            provider=provider,
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name,
            boq_name=boq_name,
            refresh_token=refresh_token,
            module=module,
            meta_data=meta_data if meta_data else None
        )
        db.add(db_integration)
        
    db.commit()
    db.refresh(db_integration)
    return {"status": "success", "integration_id": db_integration.id}

@router.post("/integrations/{integration_id}/sync-import")
async def trigger_sync_import(
    integration_id: int, 
    db: Session = Depends(get_db)
):
    """
    Triggers an initial/manual pull import from the linked spreadsheet synchronously.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")
        
    await run_initial_import(db, integration_id)

    # Return validation result so the frontend knows if items were saved or preview-only
    from ..models.boq_document import BoqDocument
    boq_doc = db.query(BoqDocument).filter(
        BoqDocument.integration_id == integration.id
    ).order_by(BoqDocument.id.desc()).first()

    preview_only = boq_doc.preview_only if boq_doc else False
    return {
        "status": "success",
        "preview_only": preview_only,
        "validation_status": boq_doc.validation_status if boq_doc else None,
        "validation_score": boq_doc.validation_score if boq_doc else None,
        "validation_issues": boq_doc.validation_issues if boq_doc else [],
        "validation_summary": boq_doc.validation_summary if boq_doc else None,
        "message": (
            "Workbook linked for preview only. It does not meet the BoQ structure requirements and has not been saved to the database."
            if preview_only else
            "Spreadsheet sync completed successfully. Items saved to database."
        ),
    }

@router.delete("/integrations/{integration_id}")
async def delete_integration(
    integration_id: int,
    purge_data: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Deletes the spreadsheet integration connection for a project.
    If purge_data is True, also permanently purges all associated BoqDocument, BoqItem,
    IpcDocument, BudgetDocument, and Document records from the database.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")

    is_budget = integration.module == "budgets" or integration.module == "budget"
    project_id = integration.project_id

    if purge_data:
        # 1. Delete associated BOQ documents & items
        from ..models.boq_document import BoqDocument
        from ..models.boq_item import BoqItem
        boq_docs = db.query(BoqDocument).filter(BoqDocument.integration_id == integration_id).all()
        for bdoc in boq_docs:
            db.query(BoqItem).filter(BoqItem.boq_id == bdoc.id).delete(synchronize_session=False)
            db.delete(bdoc)

        # 2. Delete associated IPC documents
        from ..models.ipc_document import IpcDocument
        db.query(IpcDocument).filter(IpcDocument.integration_id == integration_id).delete(synchronize_session=False)

        # 3. Delete associated Budget documents
        from ..models.budget_document import BudgetDocument
        db.query(BudgetDocument).filter(BudgetDocument.integration_id == integration_id).delete(synchronize_session=False)

        # 4. Delete associated General documents
        from ..models.document import Document
        db.query(Document).filter(Document.integration_id == integration_id).delete(synchronize_session=False)

    db.delete(integration)
    db.commit()

    # 5. Re-reconcile Budget Master Bundle Matrix if it was a Budget Integration
    if is_budget:
        from ..models.budget import Budget
        from ..services.integrations.budget_ai_engine import reconcile_master_bundle_ai
        
        budget = db.query(Budget).filter(Budget.project_id == project_id).first()
        if budget:
            values_map = budget.values_map or {}
            matrix = values_map.get("master_bundle_matrix", [])
            
            # Remove the deleted integration
            new_matrix = [m for m in matrix if m.get("integration_id") != integration_id]
            
            if len(new_matrix) < len(matrix):
                # We removed something, need to reconcile
                from ..models.project import Project
                proj = db.query(Project).filter(Project.id == project_id).first()
                proj_title = proj.name if proj else ""
                
                if new_matrix:
                    reconciled_master = await reconcile_master_bundle_ai(new_matrix, proj_title)
                    master_orig = reconciled_master.get("original_contract_sum") or 0.0
                    master_appr = reconciled_master.get("appraised_budget")
                    master_ev = reconciled_master.get("earned_value") or 0.0
                    
                    budget.amount = master_orig
                    budget.revised_amount = master_appr if master_appr is not None else master_orig
                    budget.earned_value = master_ev
                    
                    values_map["master_bundle_matrix"] = new_matrix
                    values_map["master_cleaned_table"] = reconciled_master
                    values_map["original_contract_sum"] = master_orig
                    values_map["appraised_budget"] = master_appr
                    values_map["is_appraised"] = master_appr is not None and master_appr != master_orig
                    values_map["earned_value"] = master_ev
                    values_map["remaining_balance"] = reconciled_master.get("remaining_balance", 0.0)
                    values_map["percent_used"] = reconciled_master.get("percent_used", 0.0)
                    values_map["summary_breakdown"] = reconciled_master.get("reconciled_categories", [])
                    
                    # Also update linked_count
                    bundle_config = values_map.get("bundle_config", {})
                    bundle_config["linked_count"] = len(new_matrix)
                    bundle_config["is_complete"] = len(new_matrix) >= bundle_config.get("expected_count", 1)
                    values_map["bundle_config"] = bundle_config
                else:
                    # Matrix is empty, reset budget totals
                    budget.amount = 0.0
                    budget.revised_amount = 0.0
                    budget.earned_value = 0.0
                    
                    values_map["master_bundle_matrix"] = []
                    values_map["master_cleaned_table"] = {}
                    values_map["original_contract_sum"] = 0.0
                    values_map["appraised_budget"] = None
                    values_map["is_appraised"] = False
                    values_map["earned_value"] = 0.0
                    values_map["remaining_balance"] = 0.0
                    values_map["percent_used"] = 0.0
                    values_map["summary_breakdown"] = []
                    
                    bundle_config = values_map.get("bundle_config", {})
                    bundle_config["linked_count"] = 0
                    bundle_config["is_complete"] = False
                    values_map["bundle_config"] = bundle_config
                
                budget.values_map = values_map
                db.commit()

    return {"status": "success", "message": "Integration and associated document data deleted successfully."}

@router.get("/integrations/{integration_id}/check-update")
async def check_integration_update(integration_id: int, db: Session = Depends(get_db)):
    """
    Compares the remote file modified datetime against local last_synced_at, and detects any newly added sheet tabs.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")
        
    res_data = {"has_updates": False, "new_sheets": []}
    
    # If never synced yet, return no updates — the badge would be misleading.
    # The "Sync Workbook" button handles the first-import case.
    if not integration.last_synced_at:
        return res_data
        
    try:
        import datetime
        import httpx
        import json
        decrypted = decrypt_token(integration.refresh_token)
        
        # Parse selected sheet names
        try:
            selected_sheets = json.loads(integration.sheet_name)
        except Exception:
            selected_sheets = []
            
        selected_ids = {s.get("id") or s.get("name") for s in selected_sheets if isinstance(s, dict)}
        selected_names = {s.get("name") for s in selected_sheets if isinstance(s, dict)}
        
        remote_sheets = []
        modified_str = None
        
        if integration.provider == "google_sheets":
            from ..services.integrations.google_sheets import refresh_google_access_token, get_google_spreadsheet_sheets
            access_token = await refresh_google_access_token(decrypted)
            
            # Fetch remote sheets list
            remote_sheets = await get_google_spreadsheet_sheets(integration.spreadsheet_id, access_token)
            
            url = f"https://www.googleapis.com/drive/v3/files/{integration.spreadsheet_id}?fields=modifiedTime"
            headers = {"Authorization": f"Bearer {access_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    modified_str = resp.json().get("modifiedTime")
        else:
            from ..services.integrations.onedrive import refresh_onedrive_access_token, get_onedrive_sheets
            access_token = await refresh_onedrive_access_token(decrypted)
            
            # Fetch remote sheets list
            remote_sheets = await get_onedrive_sheets(integration.spreadsheet_id, access_token)
            
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{integration.spreadsheet_id}?select=lastModifiedDateTime"
            headers = {"Authorization": f"Bearer {access_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    modified_str = resp.json().get("lastModifiedDateTime")
                    
        # Parse modified time
        if modified_str:
            modified_dt = datetime.datetime.fromisoformat(modified_str.replace("Z", "+00:00"))
            last_synced = integration.last_synced_at.replace(tzinfo=datetime.timezone.utc)
            res_data["has_updates"] = modified_dt > last_synced + datetime.timedelta(seconds=5)
            
        # Detect new sheets — exclude already-dismissed ones
        dismissed_raw = integration.dismissed_sheets
        try:
            dismissed_set = set(json.loads(dismissed_raw)) if dismissed_raw else set()
        except Exception:
            dismissed_set = set()
            
        new_sheets = []
        for s in remote_sheets:
            s_id = s.get("id")
            s_name = s.get("name")
            if s_id not in selected_ids and s_name not in selected_names and s_name not in dismissed_set:
                new_sheets.append(s_name)
        res_data["new_sheets"] = new_sheets
        
    except Exception as e:
        logger.error(f"Error checking integration updates: {e}")
        
    return res_data

@router.post("/integrations/{integration_id}/dismiss-sheets")
async def dismiss_new_sheets(integration_id: int, sheet_names: list[str], db: Session = Depends(get_db)):
    """
    Persistently marks the given sheet tab names as 'dismissed' so they are excluded
    from the new_sheets list in future check-update polls. Called when the user clicks
    'Clear Alert' or saves configuration without adding the sheet.
    """
    import json
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")
    
    try:
        existing = set(json.loads(integration.dismissed_sheets)) if integration.dismissed_sheets else set()
    except Exception:
        existing = set()
        
    existing.update(sheet_names)
    integration.dismissed_sheets = json.dumps(list(existing))
    db.commit()
    return {"status": "ok", "dismissed_sheets": list(existing)}

@router.get("/integrations/{integration_id}/open")
async def open_integration_file(integration_id: int, db: Session = Depends(get_db)):
    """
    Fetches the live web view URL for the spreadsheet file and redirects the browser to it.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")
        
    try:
        import httpx
        decrypted = decrypt_token(integration.refresh_token)
        
        if integration.provider == "google_sheets":
            from ..services.integrations.google_sheets import refresh_google_access_token
            access_token = await refresh_google_access_token(decrypted)
            
            # Google Drive v3 API: webViewLink
            url = f"https://www.googleapis.com/drive/v3/files/{integration.spreadsheet_id}?fields=webViewLink"
            headers = {"Authorization": f"Bearer {access_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    link = resp.json().get("webViewLink")
                    if link:
                        return RedirectResponse(url=link)
        else:
            from ..services.integrations.onedrive import refresh_onedrive_access_token
            access_token = await refresh_onedrive_access_token(decrypted)
            
            # MS Graph: webUrl
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{integration.spreadsheet_id}?select=webUrl"
            headers = {"Authorization": f"Bearer {access_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    link = resp.json().get("webUrl")
                    if link:
                        return RedirectResponse(url=link)
    except Exception as e:
        logger.error(f"Error opening integration file: {e}")
        
    # Fallback to general provider homepage
    fallback_url = "https://docs.google.com" if integration.provider == "google_sheets" else "https://onedrive.live.com"
    return RedirectResponse(url=fallback_url)

@router.get("/integrations/{integration_id}/embed-url")
async def get_integration_embed_url(
    integration_id: int,
    mode: str = "edit",
    db: Session = Depends(get_db)
):
    """
    Retrieves a formatted embeddable URL for Google Sheets or OneDrive/SharePoint.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")

    if mode not in ("edit", "view"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be 'edit' or 'view'.")

    try:
        decrypted = decrypt_token(integration.refresh_token)

        if integration.provider == "google_sheets":
            from ..services.integrations.embed_service import get_google_embed_url
            embed_url = await get_google_embed_url(integration.spreadsheet_id, mode)
            return {"url": embed_url}

        elif integration.provider == "onedrive":
            import httpx
            from ..services.integrations.onedrive import refresh_onedrive_access_token
            from ..services.integrations.embed_service import get_onedrive_embed_url
            
            access_token = await refresh_onedrive_access_token(decrypted)
            
            # Fetch webUrl from MS Graph
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{integration.spreadsheet_id}?select=webUrl"
            headers = {"Authorization": f"Bearer {access_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=resp.status_code, 
                        detail=f"Microsoft Graph API error while fetching webUrl: {resp.text}"
                    )
                web_url = resp.json().get("webUrl")
                if not web_url:
                    raise HTTPException(status_code=500, detail="No webUrl found for the spreadsheet in Microsoft Graph.")
            
            embed_url = await get_onedrive_embed_url(web_url, mode)
            return {"url": embed_url}
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate embed URL:")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/integrations/{integration_id}/sheets")
async def get_active_integration_sheets(integration_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the sheet tabs catalog of an active integration using its stored credentials.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")
        
    try:
        from ..utils.security import decrypt_token
        from ..services.integrations.sync_service import auto_map_columns
        decrypted = decrypt_token(integration.refresh_token)
        
        if integration.provider == "google_sheets":
            from ..services.integrations import (
                refresh_google_access_token,
                get_google_spreadsheet_sheets,
                get_google_sheets_batch_first_rows
            )
            access_token = await refresh_google_access_token(decrypted)
            sheets = await get_google_spreadsheet_sheets(integration.spreadsheet_id, access_token)
            sheet_names = [s["name"] for s in sheets]
            rows_dict = await get_google_sheets_batch_first_rows(integration.spreadsheet_id, sheet_names, access_token)
            for s in sheets:
                rows = rows_dict.get(s["name"], [])
                header_idx, _ = auto_map_columns(rows)
                s["has_headers"] = header_idx != -1
            return sheets
        else:
            from ..services.integrations import (
                refresh_onedrive_access_token,
                get_onedrive_sheets,
                get_onedrive_sheets_first_rows
            )
            access_token = await refresh_onedrive_access_token(decrypted)
            sheets = await get_onedrive_sheets(integration.spreadsheet_id, access_token)
            sheet_names = [s["name"] for s in sheets]
            rows_dict = await get_onedrive_sheets_first_rows(integration.spreadsheet_id, sheet_names, access_token)
            for s in sheets:
                rows = rows_dict.get(s["name"], [])
                header_idx, _ = auto_map_columns(rows)
                s["has_headers"] = header_idx != -1
            return sheets
    except Exception as e:
        logger.exception("Failed to load active sheets:")
        raise HTTPException(status_code=500, detail=str(e))

# --- Webhooks Listener ---

@router.post("/webhooks/sync")
async def webhook_listener(
    request: Request,
    background_tasks: BackgroundTasks,
    validationToken: Optional[str] = Query(None),  # Microsoft Graph webhook validation parameter
    db: Session = Depends(get_db)
):
    """
    Receives push events from Google Sheets or Microsoft Graph when rows are edited.
    Supports MS Graph subscription validation checks.
    """
    # 1. MS Graph Webhook Validation Request
    if validationToken:
        logger.info("Handling MS Graph webhook validation request.")
        return PlainTextResponse(content=validationToken, status_code=200)
        
    # 2. Process payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")
        
    # Standard Apps Script trigger payload or Graph webhook notification
    provider = payload.get("provider")
    
    if provider == "google_sheets":
        changes = payload.get("changes", [])
        spreadsheet_id = payload.get("spreadsheet_id")
        sheet_name = payload.get("sheet_name", "Sheet1")
        
        if not spreadsheet_id or not changes:
            raise HTTPException(status_code=400, detail="Missing required parameters for google_sheets sync.")
            
        # Process updates in background
        background_tasks.add_task(
            process_sheet_webhook_update,
            db,
            provider,
            spreadsheet_id,
            sheet_name,
            changes
        )
        return {"status": "queued"}
        
    elif "value" in payload:
        # Microsoft Graph Webhook notification format (Value is a list of subscription entries)
        logger.info("Received OneDrive Microsoft Graph webhook notification.")
        # Graph webhooks are thin alerts. They do not contain row differences.
        # We find the integration and trigger a background pull comparison.
        for subscription in payload.get("value", []):
            resource = subscription.get("resource", "")
            # e.g., "me/drive/items/{item_id}"
            if "items/" in resource:
                item_id = resource.split("items/")[1].split("/")[0]
                # Find matching integrations
                integrations = db.query(ProjectIntegration).filter(
                    ProjectIntegration.provider == "onedrive",
                    ProjectIntegration.spreadsheet_id == item_id
                ).all()
                for integration in integrations:
                    background_tasks.add_task(run_initial_import, db, integration.id)
                    
        return {"status": "queued"}
        
    raise HTTPException(status_code=400, detail="Unsupported webhook provider or format.")

@router.post("/integrations/ipc/preview")
async def preview_ipc_extraction(
    request: IpcPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Phase 4 API: Authenticate, read first 12 sheets, run Pass A/B/C and LLM semantic extraction,
    and return the data to the frontend for interactive preview BEFORE committing to the database.
    """
    # 1. Obtain fresh access token
    access_token = None
    if request.refresh_token:
        decrypted_refresh = decrypt_token(request.refresh_token)
        if request.provider == 'google_sheets':
            access_token = await refresh_google_access_token(decrypted_refresh)
        elif request.provider == 'onedrive':
            access_token = await refresh_onedrive_access_token(decrypted_refresh)
            
    if not access_token:
        integration = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == request.project_id,
            ProjectIntegration.provider == request.provider
        ).first()
        if integration and integration.refresh_token:
            decrypted_refresh = decrypt_token(integration.refresh_token)
            if request.provider == 'google_sheets':
                access_token = await refresh_google_access_token(decrypted_refresh)
            elif request.provider == 'onedrive':
                access_token = await refresh_onedrive_access_token(decrypted_refresh)
                
    # Check duplicate linkage across modules
    existing_link = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == request.project_id,
        ProjectIntegration.spreadsheet_id == request.spreadsheet_id,
        ProjectIntegration.module != "budget_rejected"
    ).first()
    if existing_link and existing_link.module != "ipc":
        raise HTTPException(
            status_code=400,
            detail=f"This document is already linked under the {existing_link.module.upper()} tab for this project. Duplicate linkages are strictly prohibited."
        )

    # Check rate limits stored in PostgreSQL for this specific IPC integration
    target_integration = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == request.project_id,
        ProjectIntegration.provider == request.provider,
        ProjectIntegration.spreadsheet_id == request.spreadsheet_id
    ).first()

    recent_logs = []
    if target_integration:
        import datetime
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        twenty_four_hours_ago = now_utc - datetime.timedelta(hours=24)
        
        logs = target_integration.reextract_logs or []
        for ts_str in logs:
            try:
                ts = datetime.datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                if ts > twenty_four_hours_ago:
                    recent_logs.append(ts_str)
            except Exception:
                pass

        if len(recent_logs) >= 2:
            raise HTTPException(
                status_code=429,
                detail="Daily rate limit exceeded: Maximum 2 AI re-extractions per 24 hours allowed for this IPC document."
            )

    # 2. Fetch first 12 sheets
    sheets_data = {}
    try:
        if request.provider == 'google_sheets':
            sheets_list = await get_google_spreadsheet_sheets(request.spreadsheet_id, access_token)
            for s in sheets_list[:12]:
                rows = await get_google_sheet_rows(request.spreadsheet_id, s["name"], access_token)
                sheets_data[s["name"]] = rows
        elif request.provider == 'onedrive':
            sheets_list = await get_onedrive_sheets(request.spreadsheet_id, access_token)
            for s in sheets_list[:12]:
                rows = await get_onedrive_sheet_rows(request.spreadsheet_id, s["name"], access_token)
                sheets_data[s["name"]] = rows
    except Exception as e:
        logger.error(f"Failed to fetch cloud sheets for preview: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch cloud sheets: {str(e)}")
        
    # 3. Classify and Extract
    try:
        extracted_data = await process_ipc_with_ai(sheets_data, request.ipc_certificate_number)
        
        if not extracted_data.get("is_ipc_document"):
            raise HTTPException(status_code=400, detail="Document could not be verified as a valid IPC or missing Main IPC Summary.")
        
        # Check if this IPC already exists in the database
        legacy_exists = False
        if request.ipc_certificate_number:
            existing_ipc = db.query(IPC).filter(
                IPC.certificate_number == str(request.ipc_certificate_number),
                IPC.project_id == request.project_id
            ).first()
            if existing_ipc:
                legacy_exists = True
        
        if target_integration:
            import datetime
            recent_logs.append(datetime.datetime.now(datetime.timezone.utc).isoformat())
            target_integration.reextract_logs = recent_logs
            db.commit()

        return {
            "extracted_data": extracted_data,
            "legacy_exists": legacy_exists
        }
    except Exception as e:
        logger.exception("AI Extraction failed:")
        raise HTTPException(status_code=500, detail=str(e))

async def _fetch_budget_sheets(request: BudgetPreviewRequest, db: Session):
    """
    Shared helper: obtains an access token and fetches sheet data for a budget request.
    Returns the sheets_data dict.
    """
    access_token = None
    if request.refresh_token:
        decrypted_refresh = decrypt_token(request.refresh_token)
        if request.provider == 'google_sheets':
            access_token = await refresh_google_access_token(decrypted_refresh)
        elif request.provider == 'onedrive':
            access_token = await refresh_onedrive_access_token(decrypted_refresh)

    if not access_token:
        integration = db.query(ProjectIntegration).filter(
            ProjectIntegration.project_id == request.project_id,
            ProjectIntegration.provider == request.provider
        ).first()
        if integration and integration.refresh_token:
            decrypted_refresh = decrypt_token(integration.refresh_token)
            if request.provider == 'google_sheets':
                access_token = await refresh_google_access_token(decrypted_refresh)
            elif request.provider == 'onedrive':
                access_token = await refresh_onedrive_access_token(decrypted_refresh)

    sheets_data = {}
    try:
        if request.provider == 'google_sheets':
            sheets_list = await get_google_spreadsheet_sheets(request.spreadsheet_id, access_token)
            target_names = request.selected_sheets if request.selected_sheets else [s["name"] for s in sheets_list[:5]]
            sheets_to_fetch = [s for s in sheets_list if s["name"] in target_names]
            async def fetch_sheet(s):
                rows = await get_google_sheet_rows(request.spreadsheet_id, s["name"], access_token)
                return s["name"], rows
            results = await asyncio.gather(*[fetch_sheet(s) for s in sheets_to_fetch])
            for name, rows in results:
                sheets_data[name] = rows
        elif request.provider == 'onedrive':
            sheets_list = await get_onedrive_sheets(request.spreadsheet_id, access_token)
            target_names = request.selected_sheets if request.selected_sheets else [s["name"] for s in sheets_list[:5]]
            sheets_to_fetch = [s for s in sheets_list if s["name"] in target_names]
            async def fetch_sheet(s):
                rows = await get_onedrive_sheet_rows(request.spreadsheet_id, s["name"], access_token)
                return s["name"], rows
            results = await asyncio.gather(*[fetch_sheet(s) for s in sheets_to_fetch])
            for name, rows in results:
                sheets_data[name] = rows
    except Exception as e:
        logger.error(f"Failed to fetch cloud sheets for budget: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch cloud sheets: {str(e)}")
    return sheets_data


@router.post("/integrations/budget/validate")
async def validate_budget_document(
    request: BudgetPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Validation-only endpoint: Runs AI classification on the document to determine
    if it is a valid budget document. Does NOT perform extraction or commit.
    Returns {valid: true/false, reason: ...}.
    """
    # Check if this document was already rejected
    existing_rejected = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == request.project_id,
        ProjectIntegration.spreadsheet_id == request.spreadsheet_id,
        ProjectIntegration.module == "budget_rejected"
    ).first()
    if existing_rejected:
        doc_type = (existing_rejected.meta_data or {}).get("identified_document_type", "Unknown Document")
        return {
            "valid": False,
            "reason": doc_type,
            "previously_flagged": True
        }

    # Check duplicate linkage across modules
    existing_link = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == request.project_id,
        ProjectIntegration.spreadsheet_id == request.spreadsheet_id,
        ProjectIntegration.module != "budget_rejected"
    ).first()
    if existing_link and existing_link.module not in ("budget", "budgets"):
        raise HTTPException(
            status_code=400,
            detail=f"This document is already linked under the {existing_link.module.upper()} tab for this project. Duplicate linkages are strictly prohibited."
        )

    sheets_data = await _fetch_budget_sheets(request, db)

    try:
        project = db.query(Project).filter(Project.id == request.project_id).first()
        proj_name = project.name if project else ""
        extracted_data = await process_budget_with_ai(sheets_data, proj_name, request.trade_label or "")

        if not extracted_data.get("is_budget_document"):
            doc_type = extracted_data.get("identified_document_type", "Unknown Document")

            # Persist rejection record
            db_integration = ProjectIntegration(
                project_id=request.project_id,
                provider=request.provider,
                spreadsheet_id=request.spreadsheet_id,
                refresh_token=request.refresh_token or "rejected_no_token",
                sheet_name="Rejected",
                module="budget_rejected",
                meta_data={"identified_document_type": doc_type, "rejection_reason": doc_type}
            )
            try:
                db.add(db_integration)
                db.commit()
            except OperationalError as oe:
                logger.warning(f"DB commit failed due to {oe}, rolling back and retrying")
                db.rollback()
                db.add(db_integration)
                db.commit()

            return {
                "valid": False,
                "reason": doc_type,
                "previously_flagged": False
            }

        return {"valid": True, "reason": None}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI Budget Validation failed:")
        raise HTTPException(status_code=500, detail=f"Budget validation failed: {str(e)}")


@router.post("/integrations/budget/preview")
async def preview_budget_extraction(
    request: BudgetPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Budget AI Extraction API: Reads first 150 rows of up to 12 sheet tabs,
    runs semantic AI summary extraction (original vs appraised, category breakdown, earned value),
    and returns data for interactive human preview BEFORE committing to PostgreSQL.
    Only called AFTER the /budget/validate endpoint has confirmed the document is valid.
    """
    # Block previously rejected documents from extraction
    existing_rejected = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == request.project_id,
        ProjectIntegration.spreadsheet_id == request.spreadsheet_id,
        ProjectIntegration.module == "budget_rejected"
    ).first()
    if existing_rejected:
        doc_type = (existing_rejected.meta_data or {}).get("identified_document_type", "Unknown Document")
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_BUDGET_DOCUMENT",
                "identified_document_type": doc_type,
                "message": f"This document was previously rejected as a '{doc_type}'. Budget extraction is not allowed."
            }
        )

    # Check duplicate linkage across modules
    existing_link = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == request.project_id,
        ProjectIntegration.spreadsheet_id == request.spreadsheet_id,
        ProjectIntegration.module != "budget_rejected"
    ).first()
    if existing_link and existing_link.module not in ("budget", "budgets"):
        raise HTTPException(
            status_code=400,
            detail=f"This document is already linked under the {existing_link.module.upper()} tab for this project. Duplicate linkages are strictly prohibited."
        )

    sheets_data = await _fetch_budget_sheets(request, db)

    try:
        project = db.query(Project).filter(Project.id == request.project_id).first()
        proj_name = project.name if project else ""
        extracted_data = await process_budget_with_ai(sheets_data, proj_name, request.trade_label or "")

        if not extracted_data.get("is_budget_document"):
            doc_type = extracted_data.get("identified_document_type", "Unknown Document")
            raise HTTPException(status_code=400, detail={
                "error_code": "INVALID_BUDGET_DOCUMENT",
                "identified_document_type": doc_type
            })

        return {"extracted_data": extracted_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI Budget Extraction failed:")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/integrations/budget/commit")
async def commit_budget_extraction(
    request: BudgetCommitRequest,
    db: Session = Depends(get_db)
):
    """
    Commits human-validated Budget Summary & Category Appraisals to PostgreSQL.
    Appends individual workbook JSON to values_map->master_bundle_matrix and
    runs AI cross-workbook reconciliation to generate the cleaned-up Master Table.
    """
    from ..models.budget import Budget
    from ..models.budget_document import BudgetDocument
    from ..models.contract import Contract
    from ..services.integrations.budget_ai_engine import reconcile_master_bundle_ai

    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contract_id = request.contract_id
    if not contract_id:
        general_contract = db.query(Contract).filter(
            Contract.project_id == request.project_id,
            Contract.contract_type == "GENERAL"
        ).first()
        if not general_contract:
            general_contract = Contract(project_id=request.project_id, name="General Contract", contract_type="GENERAL")
            db.add(general_contract)
            db.commit()
            db.refresh(general_contract)
        contract_id = general_contract.id

    # Fetch or create master Budget record for project
    budget = db.query(Budget).filter(Budget.project_id == request.project_id).first()
    if not budget:
        budget = Budget(
            project_id=request.project_id,
            contract_id=contract_id,
            name="Master Project Budget",
            amount=request.original_contract_sum
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)

    # Prepare current workbook JSON entry
    current_wb_entry = {
        "integration_id": request.integration_id,
        "trade_label": request.trade_label or "General Trade",
        "title": request.title or "Master Budget & EVM",
        "file_url": request.file_url,
        "extracted_project_name": request.project_title_found,
        "summary_metrics": {
            "original_contract_sum": request.original_contract_sum,
            "appraised_budget": request.appraised_budget,
            "earned_value": request.earned_value,
            "remaining_balance": request.remaining_balance,
            "percent_used": request.percent_used
        },
        "categories": request.categories
    }

    values_map = budget.values_map or {}
    bundle_config = values_map.get("bundle_config", {})
    expected_cnt = request.expected_count or bundle_config.get("expected_count", 1)

    # Master Bundle Matrix array
    matrix = values_map.get("master_bundle_matrix", [])
    # Update existing entry if integration_id matches or append new
    updated = False
    if request.integration_id:
        for idx, item in enumerate(matrix):
            if item.get("integration_id") == request.integration_id:
                matrix[idx] = current_wb_entry
                updated = True
                break
    if not updated:
        matrix.append(current_wb_entry)

    # Truncate matrix if over max limit 5
    matrix = matrix[:5]
    linked_cnt = len(matrix)

    # Run AI Cross-Workbook Reconciliation Engine
    proj_title = project.name or ""
    reconciled_master = await reconcile_master_bundle_ai(matrix, proj_title)

    # Update top-level budget fields from AI-reconciled master totals
    master_orig = reconciled_master.get("original_contract_sum") or request.original_contract_sum
    master_appr = reconciled_master.get("appraised_budget")
    master_ev = reconciled_master.get("earned_value") or request.earned_value

    if master_orig > 0:
        budget.amount = master_orig
    if master_appr is not None:
        budget.revised_amount = master_appr
    if master_ev is not None:
        budget.earned_value = master_ev

    # Store master JSON matrix and cleaned master table in values_map
    values_map.update({
        "bundle_config": {
            "expected_count": expected_cnt,
            "linked_count": linked_cnt,
            "is_complete": linked_cnt >= expected_cnt
        },
        "master_bundle_matrix": matrix,
        "master_cleaned_table": reconciled_master,
        "original_contract_sum": master_orig,
        "appraised_budget": master_appr,
        "is_appraised": master_appr is not None and master_appr != master_orig,
        "earned_value": master_ev,
        "remaining_balance": reconciled_master.get("remaining_balance", 0.0),
        "percent_used": reconciled_master.get("percent_used", 0.0),
        "summary_breakdown": reconciled_master.get("reconciled_categories", [])
    })

    budget.values_map = values_map
    db.commit()
    db.refresh(budget)

    # Link/create BudgetDocument reference if file_url provided
    if request.file_url or request.title:
        new_doc = BudgetDocument(
            budget_id=budget.id,
            project_id=request.project_id,
            contract_id=contract_id,
            name=f"[{request.trade_label}] {request.title or 'Budget Sheet'}",
            file_url=request.file_url,
            origin="cloud_integration" if request.integration_id else "file_upload",
            integration_id=request.integration_id
        )
        db.add(new_doc)
        db.commit()

    if request.integration_id:
        integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == request.integration_id).first()
        if integration:
            meta_data = integration.meta_data or {}
            meta_data["trade_label"] = request.trade_label
            integration.meta_data = meta_data
            db.commit()

    return {
        "status": "success",
        "message": f"Successfully committed budget workbook '{request.trade_label}' and reconciled Master Table.",
        "budget_id": budget.id,
        "master_cleaned_table": reconciled_master
    }


