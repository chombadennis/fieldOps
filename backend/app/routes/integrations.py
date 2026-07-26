import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Query
from fastapi.responses import RedirectResponse, PlainTextResponse
from sqlalchemy.orm import Session
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

# --- OAuth Authorization Redirect URLs ---

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
    folder_id: Optional[str] = None,
    filter_type: Optional[str] = "spreadsheets"
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
                    "web_url": f.get("webViewLink")
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
                            "web_url": web_url
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

    existing = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == project_id,
        ProjectIntegration.contract_id == contract_id,
        ProjectIntegration.provider == provider,
        ProjectIntegration.spreadsheet_id == spreadsheet_id
    ).first()
    
    if not existing and not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required for new integrations.")
        
    if existing:
        existing.spreadsheet_id = spreadsheet_id
        existing.sheet_name = sheet_name
        if boq_name is not None:
            existing.boq_name = boq_name
        if refresh_token:
            existing.refresh_token = refresh_token
        if module:
            existing.module = module
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
            module=module
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
def delete_integration(integration_id: int, db: Session = Depends(get_db)):
    """
    Deletes the spreadsheet integration connection for a project.
    """
    integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found.")
    db.delete(integration)
    db.commit()
    return {"status": "success", "message": "Integration disconnected successfully."}

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
                
    if not access_token:
        raise HTTPException(status_code=400, detail="Missing or invalid authentication tokens.")
        
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
        
        return {
            "extracted_data": extracted_data,
            "legacy_exists": legacy_exists
        }
    except Exception as e:
        logger.exception("AI Extraction failed:")
        raise HTTPException(status_code=500, detail=str(e))
