import logging
import httpx
from typing import List, Dict, Any, Optional
from ...core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"

def get_google_auth_url(project_id: int, state: Optional[str] = None) -> str:
    """
    Generate Google OAuth URL.
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
        "access_type": "offline",
        "prompt": "consent",
        "state": state if state else str(project_id)
    }
    import urllib.parse
    query = urllib.parse.urlencode(params)
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
            
        token_data = response.json()
        
        # Fetch user's email
        access_token = token_data.get("access_token")
        if access_token:
            userinfo_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if userinfo_response.status_code == 200:
                userinfo = userinfo_response.json()
                token_data["email"] = userinfo.get("email")
                
        return token_data

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
    import urllib.parse
    # Quoting the sheet name allows fetching the entire grid including all columns to the right.
    quoted_sheet_name = f"'{sheet_name}'"
    range_name = urllib.parse.quote(quoted_sheet_name)
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
    # Fetch rows 1 to 15 without column limits, allowing scanning of columns far to the right.
    ranges_query = "&".join("ranges=" + urllib.parse.quote(f"'{name}'!1:15") for name in sheet_names)
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


async def convert_excel_to_google_sheet(file_id: str, access_token: str) -> Dict[str, Any]:
    """
    Converts a raw Excel file (.xlsx/.xls) stored in Google Drive into native Google Sheets format.
    Uses Google Drive API files.copy with mimeType application/vnd.google-apps.spreadsheet.
    """
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}/copy"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    body = {
        "mimeType": "application/vnd.google-apps.spreadsheet"
    }
    
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(url, headers=headers, json=body)
        if response.status_code != 200:
            logger.error(f"Failed to convert Excel file to Google Sheet: {response.text}")
            raise Exception(f"Google Drive Conversion Error: {response.text}")
        return response.json()


