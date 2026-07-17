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
from ..utils.security import encrypt_token, decrypt_token
from ..services.integrations import (
    get_google_auth_url,
    exchange_google_code_for_tokens,
    get_onedrive_auth_url,
    exchange_onedrive_code_for_tokens,
    run_initial_import,
    process_sheet_webhook_update
)

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

# --- OAuth Authorization Redirect URLs ---

@router.get("/integrations/google/auth-url")
def google_auth_url(project_id: int):
    """
    Returns the Google Sheets OAuth consent URL for a specific project.
    """
    url = get_google_auth_url(project_id)
    return {"url": url}

@router.get("/integrations/onedrive/auth-url")
def onedrive_auth_url(project_id: int):
    """
    Returns the Microsoft Graph OAuth consent URL for a specific project.
    """
    url = get_onedrive_auth_url(project_id)
    return {"url": url}

# --- OAuth Callbacks ---

@router.get("/integrations/google/callback")
async def google_callback(
    code: str,
    state: str,  # This contains our project_id
    db: Session = Depends(get_db)
):
    """
    Handles Google OAuth redirect, exchanges code for refresh token, and redirects back to dashboard.
    """
    try:
        project_id = int(state)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id state parameter.")
        
    try:
        tokens = await exchange_google_code_for_tokens(code)
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            # Note: Google only sends the refresh_token during the *first* consent approval.
            # If re-authenticating, users may need to revoke permissions first, or we check if we already have it.
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
            
        # Redirect to frontend dashboard with success parameters
        # We can store the tokens temporarily in the DB or session
        frontend_url = f"{settings.FRONTEND_URL}/dashboard/{project_id}?oauth_provider=google_sheets&refresh_token={refresh_token}"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logger.exception("Google OAuth Callback Failed:")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard/{project_id}?error={str(e)}")

@router.get("/integrations/onedrive/callback")
async def onedrive_callback(
    code: str,
    state: str,  # Contains project_id
    db: Session = Depends(get_db)
):
    """
    Handles OneDrive OAuth redirect, exchanges code for refresh token, and redirects to dashboard.
    """
    try:
        project_id = int(state)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id state parameter.")
        
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
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logger.exception("OneDrive OAuth Callback Failed:")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard/{project_id}?error={str(e)}")

@router.get("/integrations/list-files")
async def list_cloud_files(
    provider: str,
    refresh_token: str,
    folder_id: Optional[str] = None
):
    """
    Given an encrypted refresh token and optional folder_id, fetches access token,
    and returns a list of subfolders and compatible spreadsheet files inside that folder.
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
        url = f"https://www.googleapis.com/drive/v3/files?q={encoded_q}&fields=files(id,name,mimeType)"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient() as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail=f"Google Drive API error: {res.text}")
            files = res.json().get("files", [])
            
            mapped = []
            for f in files:
                is_folder = f.get("mimeType") == "application/vnd.google-apps.folder"
                mapped.append({
                    "id": f["id"],
                    "name": f["name"],
                    "type": "folder" if is_folder else "file"
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
            for item in items:
                is_folder = "folder" in item
                is_file = "file" in item
                name = item.get("name", "")
                
                if is_folder:
                    files_list.append({
                        "id": item["id"],
                        "name": name,
                        "type": "folder"
                    })
                elif is_file and (name.lower().endswith(".xlsx") or name.lower().endswith(".xls")):
                    files_list.append({
                        "id": item["id"],
                        "name": name,
                        "type": "file"
                    })
                
            return files_list
            
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider.")


@router.get("/integrations/list-sheets")
async def list_cloud_sheets(
    provider: str,
    refresh_token: str,
    spreadsheet_id: str
):
    """
    Retrieves the sheets in a spreadsheet and does a quick pre-scan to check for BOQ headers.
    """
    from ..utils.security import decrypt_token
    from ..services.integrations.sync_service import auto_map_columns
    
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
            err_msg = str(e)
            if "must not be an Office file" in err_msg or "FAILED_PRECONDITION" in err_msg:
                raise HTTPException(
                    status_code=400,
                    detail="This is a Microsoft Excel file (.xlsx) stored in Google Drive. Google Sheets API does not support reading raw Office formats directly. To resolve this: open the file in Google Drive on the web, click 'File' > 'Save as Google Sheets', and select the newly created Google Sheets file in FieldOps."
                )
            raise HTTPException(status_code=500, detail=f"Failed to fetch worksheets: {err_msg}")

        sheet_names = [s["name"] for s in sheets]
        
        rows_dict = await get_google_sheets_batch_first_rows(spreadsheet_id, sheet_names, access_token)
        
        for s in sheets:
            rows = rows_dict.get(s["name"], [])
            header_idx, _ = auto_map_columns(rows)
            s["has_headers"] = header_idx != -1
            
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
            
        sheets = await get_onedrive_sheets(spreadsheet_id, access_token)
        sheet_names = [s["name"] for s in sheets]
        
        rows_dict = await get_onedrive_sheets_first_rows(spreadsheet_id, sheet_names, access_token)
        
        for s in sheets:
            rows = rows_dict.get(s["name"], [])
            header_idx, _ = auto_map_columns(rows)
            s["has_headers"] = header_idx != -1
            
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
    refresh_token: Optional[str] = Query(None),
    boq_name: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Saves or updates a ProjectIntegration record.
    """
    existing = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == project_id,
        ProjectIntegration.provider == provider
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
        db_integration = existing
    else:
        db_integration = ProjectIntegration(
            project_id=project_id,
            provider=provider,
            spreadsheet_id=spreadsheet_id,
            sheet_name=sheet_name,
            boq_name=boq_name,
            refresh_token=refresh_token
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
    return {"status": "success", "message": "Spreadsheet sync completed successfully."}

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
    
    if not integration.last_synced_at:
        res_data["has_updates"] = True
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
            
        # Detect new sheets
        new_sheets = []
        for s in remote_sheets:
            s_id = s.get("id")
            s_name = s.get("name")
            if s_id not in selected_ids and s_name not in selected_names:
                new_sheets.append(s_name)
        res_data["new_sheets"] = new_sheets
        
    except Exception as e:
        logger.error(f"Error checking integration updates: {e}")
        
    return res_data

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
