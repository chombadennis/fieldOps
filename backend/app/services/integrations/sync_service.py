import logging
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from ...models.project_integration import ProjectIntegration
from ...models.boq_item import BoqItem
from ...models.project import Project
from ...utils.security import decrypt_token
from .google_sheets import (
    get_google_sheet_rows, 
    update_google_sheet_cell, 
    refresh_google_access_token,
    get_google_spreadsheet_sheets
)
from .onedrive import (
    get_onedrive_sheet_rows, 
    update_onedrive_sheet_cell, 
    refresh_onedrive_access_token,
    get_onedrive_sheets
)
from .utils import get_selected_sheets

logger = logging.getLogger(__name__)
from .structured_validation import is_structured_workbook, is_structured_sheet, normalize_headers, ai_assess_boq

def get_column_letter(col_idx: int) -> str:
    """
    Convert a 0-based column index to an Excel column letter (A, B, C ... AA, AB ...).
    """
    string = ""
    while col_idx >= 0:
        string = chr(col_idx % 26 + 65) + string
        col_idx = (col_idx // 26) - 1
    return string

def auto_map_columns(rows: List[List[Any]]) -> Tuple[int, Dict[str, int]]:
    """
    Fuzzy scans the first few rows to locate the header row and map target database fields
    to spreadsheet column indices.
    """
    for r_idx, row in enumerate(rows[:15]):
        cleaned_cells = [str(cell).strip().lower() for cell in row]
        temp_map = {}
        for c_idx, cell in enumerate(cleaned_cells):
            if not cell:
                continue
            if any(x in cell for x in ["item no", "item number", "item_no", "bill item number"]) or cell in ["item", "no.", "code"]:
                temp_map["bill_item_number"] = c_idx
            elif any(x in cell for x in ["description", "particulars", "item description"]):
                temp_map["description"] = c_idx
            elif cell in ["unit", "units"]:
                temp_map["unit"] = c_idx
            elif any(x in cell for x in ["qty", "quantity", "quantities"]):
                temp_map["quantity"] = c_idx
            elif any(x in cell for x in ["rate", "price", "unit rate", "unit price"]):
                temp_map["rate"] = c_idx
            elif any(x in cell for x in ["amount", "total", "total amount", "cost", "use only", "tenderer", "summary"]):
                temp_map["amount"] = c_idx
        
        # Consider it a header row if we match Description and two other BOQ columns, 
        # or if we have at least Description and Amount (e.g. for simple summaries/PC sums)
        if (len(temp_map) >= 3 and "description" in temp_map) or (len(temp_map) == 2 and "description" in temp_map and "amount" in temp_map):
            return r_idx, temp_map
            
    return -1, {}

def safe_float(val: Any) -> float:
    """
    Safely clean and parse numerical cell values.
    """
    if val is None:
        return 0.0
    s = str(val).replace(",", "").replace("$", "").replace("Ksh", "").replace("Shs", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

async def get_active_access_token(db: Session, integration: ProjectIntegration) -> str:
    """
    Decrypts the refresh token and fetches a fresh short-lived access token from the provider.
    """
    decrypted_refresh = decrypt_token(integration.refresh_token)
    if integration.provider == 'google_sheets':
        return await refresh_google_access_token(decrypted_refresh)
    elif integration.provider == 'onedrive':
        return await refresh_onedrive_access_token(decrypted_refresh)
    else:
        raise ValueError(f"Unsupported provider: {integration.provider}")

async def run_initial_import(request_db: Session, integration_id: int):
    """
    Pulls spreadsheet data, maps headers, processes hierarchy, and saves data to Postgres.
    """
    import hashlib
    import json
    from ...models.boq_document import BoqDocument
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        integration = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration_id).first()
        if not integration:
            raise Exception("Integration record not found")
            
        access_token = await get_active_access_token(db, integration)
        
        # 1. Fetch current sheets to auto-heal renames using Sheet IDs
        try:
            if integration.provider == 'google_sheets':
                current_sheets = await get_google_spreadsheet_sheets(integration.spreadsheet_id, access_token)
            else:
                current_sheets = await get_onedrive_sheets(integration.spreadsheet_id, access_token)
            current_sheets_map = {s["id"]: s["name"] for s in current_sheets}
        except Exception as e:
            logger.warning(f"Could not fetch current sheet names from API for auto-healing renames: {e}")
            current_sheets_map = {}

        configured_sheets = get_selected_sheets(integration.sheet_name)
        renamed = False
        updated_configured_sheets = []
        
        for cs in configured_sheets:
            sheet_id = cs["id"]
            old_name = cs["name"]
            
            if sheet_id in current_sheets_map:
                new_name = current_sheets_map[sheet_id]
                if new_name != old_name:
                    logger.info(f"Auto-heal: Sheet rename detected. ID={sheet_id} was renamed from '{old_name}' to '{new_name}'")
                    
                    # Update all existing BoqItems sheet_name in database matching this sheet_id
                    db.query(BoqItem).join(BoqDocument).filter(
                        BoqItem.sheet_id == sheet_id,
                        BoqDocument.contract_id == integration.contract_id
                    ).update({BoqItem.sheet_name: new_name}, synchronize_session=False)
                    
                    cs["name"] = new_name
                    renamed = True
                    
            updated_configured_sheets.append(cs)
            
        if renamed:
            integration.sheet_name = json.dumps(updated_configured_sheets)
            db.commit()
            configured_sheets = updated_configured_sheets

        # 2. Generate reference hash and check duplicates/updates
        raw_ref = f"{integration.provider}:{integration.spreadsheet_id}:{integration.sheet_name}"
        file_hash = hashlib.sha256(raw_ref.encode()).hexdigest()
        
        # Check if there is an existing BOQ Document for this integration
        boq_doc = db.query(BoqDocument).filter(
            BoqDocument.integration_id == integration.id
        ).first()
        
        if not boq_doc:
            boq_doc = db.query(BoqDocument).filter(
                BoqDocument.contract_id == integration.contract_id,
                BoqDocument.file_hash == file_hash,
                BoqDocument.integration_id == None
            ).first()
        
        if not boq_doc:
            boq_doc = db.query(BoqDocument).filter(
                BoqDocument.contract_id == integration.contract_id,
                BoqDocument.origin == integration.provider,
                BoqDocument.integration_id == None
            ).first()
        
        boq_name = integration.boq_name or (configured_sheets[0]["name"] if configured_sheets else "Spreadsheet BOQ")
        
        if boq_doc:
            # Reuse existing BoqDocument, update its details, and clear old items
            boq_doc.name = boq_name
            boq_doc.file_hash = file_hash
            boq_doc.integration_id = integration.id  # Upgrade legacy records
            boq_doc.preview_only = False
            boq_doc.validation_status = "valid"
            boq_doc.validation_score = None
            boq_doc.validation_issues = []
            db.query(BoqItem).filter(BoqItem.boq_id == boq_doc.id).delete()
            db.flush()
        else:
            # Limit check (Max 5 BOQs under this contract)
            boq_count = db.query(BoqDocument).filter(BoqDocument.contract_id == integration.contract_id).count()
            if boq_count >= 5:
                raise Exception("Limit reached: A contract can have up to 5 BOQ documents.")
                
            boq_doc = BoqDocument(
                project_id=integration.project_id,
                contract_id=integration.contract_id,
                name=boq_name,
                file_hash=file_hash,
                origin=integration.provider,
                integration_id=integration.id
            )
            db.add(boq_doc)
            db.flush()  # obtain boq_doc.id
            
        # 3. Parse and import each selected sheet
        for cs in configured_sheets:
            sheet_id = cs["id"]
            sheet_name = cs["name"]
            
            try:
                if integration.provider == 'google_sheets':
                    rows = await get_google_sheet_rows(integration.spreadsheet_id, sheet_name, access_token)
                else:
                    rows = await get_onedrive_sheet_rows(integration.spreadsheet_id, sheet_name, access_token)
            except Exception as e:
                logger.error(f"Failed to fetch rows for sheet '{sheet_name}': {e}")
                continue
            
            if not rows:
                logger.warning(f"Sheet '{sheet_name}' is empty or could not be read. Skipping.")
                continue
            
            # Locate the header row first
            header_idx, col_map = auto_map_columns(rows)
            if header_idx == -1:
                logger.warning(f"Could not locate valid headers in sheet '{sheet_name}'. Falling back to row 0 as header and default column mapping.")
                header_idx = 0
                
                # Simple heuristic mapping for text column as description and a number column as amount
                desc_col = 1
                amt_col = len(rows[0]) - 1 if len(rows[0]) > 1 else 0
                for c_idx in range(len(rows[0])):
                    col_values = [r[c_idx] for r in rows[1:15] if c_idx < len(r)]
                    # If column mostly contains strings longer than 15 chars, it is likely the description
                    if any(isinstance(v, str) and len(v) > 15 for v in col_values):
                        desc_col = c_idx
                    # If column contains floats, set it as candidate for amount
                    elif any(isinstance(v, (int, float)) or (isinstance(v, str) and v.replace(",", "").replace(".", "").strip().isdigit()) for v in col_values):
                        amt_col = c_idx
                        
                col_map = {
                    "bill_item_number": 0,
                    "description": desc_col,
                    "unit": 2 if len(rows[0]) > 2 else None,
                    "quantity": 3 if len(rows[0]) > 3 else None,
                    "rate": 4 if len(rows[0]) > 4 else None,
                    "amount": amt_col
                }

            # Construct DataFrame using the detected header row as columns
            headers = [str(h).strip() for h in rows[header_idx]]
            data_rows = rows[header_idx + 1:]
            
            # Pad/truncate rows to match headers length
            cleaned_data_rows = []
            for r in data_rows:
                if len(r) < len(headers):
                    r = list(r) + [""] * (len(headers) - len(r))
                cleaned_data_rows.append(r[:len(headers)])
                
            df = pd.DataFrame(cleaned_data_rows, columns=headers)
            
            # Verification check is now the sole validator
            try:
                ai_res = await ai_assess_boq(df)
                if not ai_res.get("valid", True) or ai_res.get("score", 1.0) < 0.75:
                    boq_doc.preview_only = True
                    boq_doc.validation_status = "invalid"
                    boq_doc.validation_score = ai_res.get("score")
                    boq_doc.validation_issues = ai_res.get("issues", [])
                    boq_doc.validation_summary = ai_res.get("summary")
                    integration.last_synced_at = datetime.utcnow()
                    db.commit()
                    logger.info(f"Sheet '{sheet_name}' rejected by verification check (score={ai_res.get('score')}). Marking workbook as preview only.")
                    return
                else:
                    boq_doc.validation_status = "valid"
                    boq_doc.validation_score = ai_res.get("score")
                    boq_doc.validation_summary = ai_res.get("summary")
            except Exception as exc:
                logger.warning(f"Verification check failed for sheet '{sheet_name}': {exc}. Proceeding without check.")


                
            # Extract and save sheet headers
            raw_headers = rows[header_idx]
            sheet_headers = []
            for idx, cell in enumerate(raw_headers):
                val = str(cell).strip() if cell is not None else ""
                if not val:
                    val = f"Column {get_column_letter(idx)}"
                sheet_headers.append(val)
                
            # Merge this sheet's headers into the BoqDocument.headers list
            current_doc_headers = boq_doc.headers or []
            for h in sheet_headers:
                if h not in current_doc_headers:
                    current_doc_headers.append(h)
            boq_doc.headers = current_doc_headers
            db.flush()
                
            hierarchy_stack = {}  # maps level -> database ID
            
            for r_idx in range(header_idx + 1, len(rows)):
                row = rows[r_idx]
                if not row:
                    continue
                    
                # Create dynamic values map verbatim for all cells
                row_values_map = {}
                for c_idx, cell in enumerate(row):
                    if c_idx < len(sheet_headers):
                        header_name = sheet_headers[c_idx]
                        row_values_map[header_name] = cell
                        
                max_idx = max([v for v in col_map.values() if v is not None])
                if len(row) <= max_idx:
                    row += [""] * (max_idx - len(row) + 1)
                    
                desc = str(row[col_map["description"]]).strip() if "description" in col_map and col_map["description"] < len(row) else ""
                if not desc:
                    continue
                    
                item_no = str(row[col_map["bill_item_number"]]).strip() if "bill_item_number" in col_map and col_map["bill_item_number"] is not None and col_map["bill_item_number"] < len(row) else ""
                unit = str(row[col_map["unit"]]).strip() if "unit" in col_map and col_map["unit"] is not None and col_map["unit"] < len(row) else None
                qty = safe_float(row[col_map["quantity"]]) if "quantity" in col_map and col_map["quantity"] is not None and col_map["quantity"] < len(row) else 0.0
                rate = safe_float(row[col_map["rate"]]) if "rate" in col_map and col_map["rate"] is not None and col_map["rate"] < len(row) else 0.0
                amount = safe_float(row[col_map["amount"]]) if "amount" in col_map and col_map["amount"] is not None and col_map["amount"] < len(row) else 0.0
                
                if amount == 0.0 and qty > 0.0 and rate > 0.0:
                    amount = qty * rate
                    
                is_header = (not unit or unit.lower() in ["", "none"]) and qty == 0.0
                row_category = "HEADER" if is_header else "LINE_ITEM"
                
                if is_header:
                    if not item_no:
                        level = 1
                    else:
                        level = max(0, item_no.count("."))
                else:
                    level = max(0, item_no.count(".")) if item_no else 2
                    
                db_item = BoqItem(
                    boq_id=boq_doc.id,
                    bill_item_number=item_no,
                    description=desc,
                    row_category=row_category,
                    hierarchy_level=level,
                    unit=unit,
                    quantity=qty,
                    rate=rate,
                    amount=amount,
                    sheet_row_index=r_idx + 1,
                    sheet_id=sheet_id,
                    sheet_name=sheet_name,
                    values_map=row_values_map
                )
                
                if level > 0:
                    parent_level = level - 1
                    while parent_level >= 0 and parent_level not in hierarchy_stack:
                        parent_level -= 1
                    if parent_level in hierarchy_stack:
                        db_item.parent_id = hierarchy_stack[parent_level]
                        
                db.add(db_item)
                db.flush()
                
                if is_header:
                    hierarchy_stack[level] = db_item.id
                    for k in list(hierarchy_stack.keys()):
                        if k > level:
                            del hierarchy_stack[k]
                            
        integration.last_synced_at = datetime.utcnow()
        db.commit()
        logger.info(f"Import complete for Project {integration.project_id}. Mapped from {integration.sheet_name}.")
    except Exception as e:
        db.rollback()
        logger.exception("Failed to run initial import background task:")
        raise e
    finally:
        db.close()

async def push_local_change_to_sheet(db: Session, boq_item_id: int, changed_fields: Dict[str, Any]):
    """
    Syncs local changes (e.g. rate, quantity adjustments from progress logs) back to the cloud spreadsheet row.
    """
    boq_item = db.query(BoqItem).filter(BoqItem.id == boq_item_id).first()
    if not boq_item or boq_item.sheet_row_index is None:
        return
        
    from ...models.boq_document import BoqDocument
    boq_doc = db.query(BoqDocument).filter(BoqDocument.id == boq_item.boq_id).first()
    if not boq_doc:
        return

    integration = db.query(ProjectIntegration).filter(
        ProjectIntegration.project_id == boq_doc.project_id,
        ProjectIntegration.contract_id == boq_doc.contract_id
    ).first()
    if not integration:
        return
        
    # Determine the sheet name
    sheet_name = boq_item.sheet_name
    if not sheet_name:
        configured = get_selected_sheets(integration.sheet_name)
        sheet_name = configured[0]["name"] if configured else "Sheet1"
        
    # Re-fetch spreadsheet to identify column indices
    access_token = await get_active_access_token(db, integration)
    
    # Auto-heal sheet name if it was renamed in the provider API
    try:
        if integration.provider == 'google_sheets':
            current_sheets = await get_google_spreadsheet_sheets(integration.spreadsheet_id, access_token)
        else:
            current_sheets = await get_onedrive_sheets(integration.spreadsheet_id, access_token)
            
        if boq_item.sheet_id:
            current_sheet = next((s for s in current_sheets if s["id"] == boq_item.sheet_id), None)
            if current_sheet and current_sheet["name"] != sheet_name:
                logger.info(f"Auto-heal during push: Sheet name changed from '{sheet_name}' to '{current_sheet['name']}'")
                sheet_name = current_sheet["name"]
                boq_item.sheet_name = sheet_name
                db.commit()
    except Exception as e:
        logger.warning(f"Could not scan sheet name renames during cell push: {e}")
    
    if integration.provider == 'google_sheets':
        rows = await get_google_sheet_rows(integration.spreadsheet_id, sheet_name, access_token)
    else:
        rows = await get_onedrive_sheet_rows(integration.spreadsheet_id, sheet_name, access_token)
        
    if not rows:
        return
        
    header_idx, col_map = auto_map_columns(rows)
    if header_idx == -1:
        return
        
    for field, new_value in changed_fields.items():
        if field not in col_map:
            continue
            
        col_letter = get_column_letter(col_map[field])
        row_idx = boq_item.sheet_row_index
        
        if integration.provider == 'google_sheets':
            await update_google_sheet_cell(
                integration.spreadsheet_id,
                sheet_name,
                row_idx,
                col_letter,
                new_value,
                access_token
            )
        else:
            await update_onedrive_sheet_cell(
                integration.spreadsheet_id,
                sheet_name,
                row_idx,
                col_letter,
                new_value,
                access_token
            )
            
    integration.last_synced_at = datetime.utcnow()
    db.commit()
    logger.info(f"Pushed local update to sheet row {boq_item.sheet_row_index} for field(s): {list(changed_fields.keys())}")


async def process_sheet_webhook_update(db: Session, provider: str, spreadsheet_id: str, sheet_name: str, changes: List[Dict[str, Any]]):
    """
    Updates the Postgres rows corresponding to edits parsed from sheet webhooks.
    """
    integration = db.query(ProjectIntegration).filter(
        ProjectIntegration.provider == provider,
        ProjectIntegration.spreadsheet_id == spreadsheet_id
    ).first()
    
    if not integration:
        logger.warning(f"No integration record matches incoming webhook: provider={provider}, spreadsheet_id={spreadsheet_id}")
        return
        
    configured_sheets = get_selected_sheets(integration.sheet_name)
    sheet_ids_or_names = {s["id"] for s in configured_sheets} | {s["name"] for s in configured_sheets}
    
    if sheet_name not in sheet_ids_or_names:
        logger.warning(f"Sheet name '{sheet_name}' is not in selected sheets for integration ID={integration.id}")
        return
        
    for change in changes:
        row_idx = change.get("row_index")
        if not row_idx:
            continue
            
        from ...models.boq_document import BoqDocument
        item = db.query(BoqItem).join(BoqDocument).filter(
            BoqDocument.project_id == integration.project_id,
            BoqDocument.contract_id == integration.contract_id,
            sa.inspect(integration) and True,  # Keep sa reference valid if needed
            BoqItem.sheet_row_index == row_idx,
            BoqItem.sheet_name == sheet_name
        ).first()
        
        if not item:
            # Try to match by sheet ID if the name was changed in the spreadsheet
            configured_sheet = next((s for s in configured_sheets if s["name"] == sheet_name or s["id"] == sheet_name), None)
            if configured_sheet:
                item = db.query(BoqItem).join(BoqDocument).filter(
                    sa.inspect(integration) and True,
                    BoqDocument.project_id == integration.project_id,
                    BoqDocument.contract_id == integration.contract_id,
                    BoqItem.sheet_row_index == row_idx,
                    BoqItem.sheet_id == configured_sheet["id"]
                ).first()
                
        if not item:
            continue
            
        # Verify that the row description matches (fuzzy check) to prevent row-shifting misalignment
        payload_desc = change.get("description", "").strip()
        if payload_desc and payload_desc.lower() != item.description.lower():
            logger.warning(f"Row mismatch detected at row {row_idx} (Local: '{item.description}', Sheet: '{payload_desc}'). Triggering auto-heal sync.")
            try:
                # Trigger a full re-import to heal the shifted indices
                await run_initial_import(db, integration.id)
            except Exception as e:
                logger.error(f"Failed to auto-heal sync: {e}")
            break
            
        modified = False
        if "quantity" in change:
            item.quantity = safe_float(change["quantity"])
            modified = True
        if "rate" in change:
            item.rate = safe_float(change["rate"])
            modified = True
        if "description" in change:
            item.description = change["description"]
            modified = True
        if "unit" in change:
            item.unit = change["unit"]
            modified = True
            
        if modified:
            item.amount = item.quantity * item.rate
            
            # Update values_map JSON keys dynamically
            if item.values_map:
                from sqlalchemy.orm.attributes import flag_modified
                v_map = dict(item.values_map)
                
                # Match fields to their corresponding worksheet headers
                field_heuristics = {
                    "quantity": ["qty", "quantity", "quantities"],
                    "rate": ["rate", "price", "unit rate", "unit price"],
                    "description": ["description", "particulars", "item description"],
                    "unit": ["unit", "units"],
                    "amount": ["amount", "total", "total amount", "cost", "use only", "tenderer", "summary"]
                }
                
                for field, val in change.items():
                    if field in field_heuristics:
                        matching_key = None
                        for key in v_map.keys():
                            k_lower = key.lower()
                            if any(keyword in k_lower for keyword in field_heuristics[field]):
                                matching_key = key
                                break
                        if matching_key:
                            v_map[matching_key] = val
                            
                item.values_map = v_map
                flag_modified(item, "values_map")
            
    integration.last_synced_at = datetime.utcnow()
    db.commit()
    logger.info(f"Applied webhook updates from {provider} to database.")
