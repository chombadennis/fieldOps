import json
from typing import List, Dict

def get_selected_sheets(sheet_name_str: str) -> List[Dict[str, str]]:
    """
    Deserializes sheet configurations (containing keys 'id' and 'name').
    If the string is not a valid JSON array of objects, falls back to parsing
    it as a comma-separated list of sheet names (e.g. for backward compatibility).
    """
    try:
        sheets = json.loads(sheet_name_str)
        if isinstance(sheets, list):
            validated = []
            for item in sheets:
                if isinstance(item, dict) and "name" in item:
                    item_id = str(item.get("id", item["name"]))
                    validated.append({"id": item_id, "name": item["name"]})
                elif isinstance(item, str):
                    validated.append({"id": item, "name": item})
            if validated:
                return validated
    except Exception:
        pass
        
    # Fallback to comma-separated
    if "," in sheet_name_str:
        return [{"id": s.strip(), "name": s.strip()} for s in sheet_name_str.split(",") if s.strip()]
        
    # Single sheet fallback
    if sheet_name_str:
        return [{"id": sheet_name_str, "name": sheet_name_str}]
        
    return []
