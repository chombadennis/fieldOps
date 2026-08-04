import logging
import urllib.parse
import httpx

logger = logging.getLogger(__name__)

async def get_google_embed_url(spreadsheet_id: str, mode: str = "edit", is_sheet: bool = True) -> str:
    """
    Constructs an embed URL for Google Sheets or Google Drive files.
    """
    if not is_sheet:
        return f"https://drive.google.com/file/d/{spreadsheet_id}/preview"

    # Native Google Sheets must use /edit?rm=minimal directly, because the /preview endpoint redirects to a viewer that hangs in iframes due to Wasm/unload policy violations.
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit?rm=minimal"

async def get_onedrive_embed_url(web_url: str, mode: str = "edit", is_office: bool = True) -> str:
    """
    Resolves and formats a Microsoft OneDrive or SharePoint URL for embedding inside an iframe.
    Handles Personal OneDrive short links (1drv.ms) by resolving redirects.
    """
    resolved_url = web_url

    # Resolve short URL if it's OneDrive Personal (1drv.ms)
    if "1drv.ms" in web_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Follow redirect to get the final onedrive.live.com URL
                r = await client.head(web_url, follow_redirects=True)
                resolved_url = str(r.url)
                logger.info(f"Resolved OneDrive short URL to: {resolved_url}")
        except Exception as e:
            logger.error(f"Failed to resolve OneDrive short URL {web_url}: {e}")
            # Fall back to original URL

    try:
        parsed = urllib.parse.urlparse(resolved_url)
        query_params = urllib.parse.parse_qs(parsed.query)

        # Legacy Personal OneDrive Format: onedrive.live.com/redir or onedrive.live.com/edit.aspx (old)
        # Modern OneDrive Personal uses SharePoint-style _layouts/15/doc.aspx and should NOT use legacy /embed
        if "onedrive.live.com" in parsed.netloc and not ("_layouts" in parsed.path or "doc.aspx" in parsed.path):
            resid = query_params.get("resid", [""])[0]
            if not resid:
                resid = query_params.get("id", [""])[0]
            authkey = query_params.get("authkey", [""])[0]
            if not resid:
                # Try parsing from path if not in query
                resid = parsed.path.split("/")[-1]
            
            # Base embed/edit structure
            embed_url = f"https://onedrive.live.com/embed?resid={resid}"
            if authkey:
                embed_url += f"&authkey={authkey}"
            
            if is_office:
                embed_url += "&em=2&wdAllowInteractivity=True"
                if mode == "edit":
                    embed_url += "&action=edit.html"
                else:
                    embed_url += "&action=embedview"
            
            return embed_url

        # Business / SharePoint Format: tenant.sharepoint.com
        else:
            if is_office:
                # Reconstruct URL with embed parameters for Office files
                query_params["action"] = ["edit.html" if mode == "edit" else "embedview"]
                query_params["wdAllowInteractivity"] = ["True"]
                
                new_query = urllib.parse.urlencode(query_params, doseq=True)
                embed_url = urllib.parse.urlunparse((
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    parsed.params,
                    new_query,
                    parsed.fragment
                ))
                return embed_url
            else:
                # Non-office files like PDFs natively support preview in SharePoint webUrl without adding action params
                return resolved_url
    except Exception as e:
        logger.error(f"Error parsing OneDrive URL for embedding: {e}")
        # Fall back to returning the original web URL with basic action parameters appended
        separator = "&" if "?" in resolved_url else "?"
        action = "edit.html" if mode == "edit" else "embedview"
        return f"{resolved_url}{separator}action={action}&wdAllowInteractivity=True"

