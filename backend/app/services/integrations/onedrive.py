import logging
import httpx
from typing import List, Dict, Any, Optional, Tuple
from ...core.config import settings

logger = logging.getLogger(__name__)

MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"

def get_onedrive_auth_url(project_id: int, state: Optional[str] = None) -> str:
    """
    Generate Microsoft Graph OAuth URL.
    """
    params = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
        "response_type": "code",
        "scope": "files.readwrite offline_access",
        "response_mode": "query",
        "state": state if state else str(project_id)
    }
    query = "&".join(f"{k}={httpx.URL(v)}" for k, v in params.items() if v is not None)
    return f"{MS_AUTH_URL}?{query}"

async def exchange_onedrive_code_for_tokens(code: str) -> Dict[str, Any]:
    """
    Exchange authorization code for access and refresh tokens.
    """
    data = {
        "code": code,
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "client_secret": settings.MICROSOFT_CLIENT_SECRET,
        "redirect_uri": settings.MICROSOFT_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(MS_TOKEN_URL, data=data)
        if response.status_code != 200:
            logger.error(f"Failed to exchange OneDrive OAuth code: {response.text}")
            raise Exception(f"OneDrive Token Exchange Error: {response.text}")
        return response.json()

async def refresh_onedrive_access_token(refresh_token: str) -> str:
    """
    Get a new access token using a refresh token.
    """
    data = {
        "client_id": settings.MICROSOFT_CLIENT_ID,
        "client_secret": settings.MICROSOFT_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(MS_TOKEN_URL, data=data)
        if response.status_code != 200:
            logger.error(f"Failed to refresh OneDrive token: {response.text}")
            raise Exception("OneDrive Token Refresh Error")
        result = response.json()
        return result["access_token"]

async def get_onedrive_sheet_rows(item_id: str, sheet_name: str, access_token: str) -> List[List[Any]]:
    """
    Get all used range row values from the workbook worksheet.
    """
    # Using Graph API usedRange endpoint
    url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/worksheets/{sheet_name}/usedRange"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to fetch OneDrive sheet: {response.text}")
            raise Exception(f"OneDrive Sheet Fetch Error: {response.text}")
        
        data = response.json()
        return data.get("values", [])

async def update_onedrive_sheet_cell(
    item_id: str, 
    sheet_name: str, 
    row_index: int, 
    column_letter: str, 
    value: Any, 
    access_token: str
):
    """
    Update a single cell in OneDrive Excel.
    Note: row_index is 1-based.
    """
    address = f"{column_letter}{row_index}"
    url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/worksheets/{sheet_name}/range(address='{address}')"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    body = {
        "values": [[value]]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.patch(url, headers=headers, json=body)
        if response.status_code != 200:
            logger.error(f"Failed to update OneDrive sheet: {response.text}")
            raise Exception(f"OneDrive Sheet Update Error: {response.text}")
        return response.json()


async def get_onedrive_sheets(item_id: str, access_token: str) -> List[Dict[str, Any]]:
    """
    Retrieves the list of worksheets (names and IDs) from a OneDrive Excel file.
    """
    url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/worksheets"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to fetch OneDrive sheets: {response.text}")
            raise Exception(f"OneDrive Sheets Fetch Error: {response.text}")
        
        data = response.json()
        sheets = []
        for item in data.get("value", []):
            sheets.append({
                "id": item["id"],
                "name": item["name"]
            })
        return sheets


async def get_onedrive_sheets_first_rows(
    item_id: str, 
    sheet_names: List[str], 
    access_token: str
) -> Dict[str, List[List[Any]]]:
    """
    Fetches the first 15 rows for multiple worksheets concurrently using asyncio.gather.
    """
    import asyncio
    
    async def fetch_rows(sheet_name: str) -> Tuple[str, List[List[Any]]]:
        # Using Microsoft Graph range endpoint to fetch A1:Z15
        address = "A1:Z15"
        url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/workbook/worksheets/{sheet_name}/range(address='{address}')"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return sheet_name, data.get("values", [])
        except Exception as e:
            logger.error(f"Error fetching first rows for OneDrive sheet {sheet_name}: {e}")
        return sheet_name, []

    tasks = [fetch_rows(name) for name in sheet_names]
    results = await asyncio.gather(*tasks)
    return dict(results)

