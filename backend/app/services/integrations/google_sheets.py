import logging
import httpx
from typing import List, Dict, Any, Optional
from ...core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

def get_google_auth_url(project_id: int) -> str:
    """
    Generate Google OAuth URL.
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly",
        "access_type": "offline",
        "prompt": "consent",
        "state": str(project_id)
    }
    # Formulate string manually or via httpx URL params
    query = "&".join(f"{k}={httpx.URL(v)}" for k, v in params.items() if v is not None)
    return f"{GOOGLE_AUTH_URL}?{query}"

async def exchange_google_code_for_tokens(code: str) -> Dict[str, Any]:
    """
    Exchange authorization code for access and refresh tokens.
    """
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=data)
        if response.status_code != 200:
            logger.error(f"Failed to exchange Google OAuth code: {response.text}")
            raise Exception(f"Google Token Exchange Error: {response.text}")
        return response.json()

async def refresh_google_access_token(refresh_token: str) -> str:
    """
    Get a new access token using a refresh token.
    """
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=data)
        if response.status_code != 200:
            logger.error(f"Failed to refresh Google token: {response.text}")
            raise Exception("Google Token Refresh Error")
        result = response.json()
        return result["access_token"]

async def get_google_sheet_rows(spreadsheet_id: str, sheet_name: str, access_token: str) -> List[List[Any]]:
    """
    Get all row values from the spreadsheet.
    """
    # Read columns A to Z
    range_name = f"{sheet_name}!A:Z"
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to fetch Google sheet: {response.text}")
            raise Exception(f"Google Sheet Fetch Error: {response.text}")
        
        data = response.json()
        return data.get("values", [])

async def update_google_sheet_cell(
    spreadsheet_id: str, 
    sheet_name: str, 
    row_index: int, 
    column_letter: str, 
    value: Any, 
    access_token: str
):
    """
    Update a single cell in Google Sheets.
    Note: row_index is 1-based.
    """
    range_name = f"{sheet_name}!{column_letter}{row_index}"
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}?valueInputOption=USER_ENTERED"
    headers = {"Authorization": f"Bearer {access_token}"}
    body = {
        "values": [[value]]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.put(url, headers=headers, json=body)
        if response.status_code != 200:
            logger.error(f"Failed to update Google sheet: {response.text}")
            raise Exception(f"Google Sheet Update Error: {response.text}")
        return response.json()


async def get_google_spreadsheet_sheets(spreadsheet_id: str, access_token: str) -> List[Dict[str, Any]]:
    """
    Retrieves the list of sheets (titles and IDs) from a Google Spreadsheet.
    """
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}?fields=sheets.properties(sheetId,title)"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to fetch Google spreadsheet sheets: {response.text}")
            raise Exception(f"Google Sheets Fetch Error: {response.text}")
        
        data = response.json()
        sheets = []
        for s in data.get("sheets", []):
            prop = s.get("properties", {})
            if "title" in prop:
                sheets.append({
                    "id": str(prop.get("sheetId", "")),
                    "name": prop["title"]
                })
        return sheets


async def get_google_sheets_batch_first_rows(
    spreadsheet_id: str, 
    sheet_names: List[str], 
    access_token: str
) -> Dict[str, List[List[Any]]]:
    """
    Fetches the first 15 rows for multiple sheets in a single batch call.
    Returns a dict mapping sheet_name -> list of rows.
    """
    if not sheet_names:
        return {}
        
    import urllib.parse
    ranges_query = "&".join(f"ranges={urllib.parse.quote(f'{name}!A1:Z15')}" for name in sheet_names)
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values:batchGet?{ranges_query}"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to batch fetch Google sheet rows: {response.text}")
            return {name: [] for name in sheet_names}
            
        data = response.json()
        value_ranges = data.get("valueRanges", [])
        
        result = {}
        for idx, vr in enumerate(value_ranges):
            # The order of the ValueRanges in the response matches the order of the requested ranges
            if idx < len(sheet_names):
                sheet_name = sheet_names[idx]
                result[sheet_name] = vr.get("values", [])
        return result

