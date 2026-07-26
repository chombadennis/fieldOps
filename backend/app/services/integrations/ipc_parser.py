import logging
from typing import List, Dict, Any, Tuple
import re

logger = logging.getLogger(__name__)

# Constants for keyword matching
IPC_SUMMARY_KEYWORDS = ["ipc", "interim payment", "valuation", "payment certificate", "certificate no"]
ADVANCE_RECOVERY_KEYWORDS = ["advance", "recovery", "deduction", "statement of advance", "advance account"]
BOQ_GRAND_SUMMARY_KEYWORDS = ["grand summary", "bill summary", "summary of boq", "recapitulation", "bills"]

def _search_keywords_in_rows(rows: List[List[Any]], keywords: List[str], num_rows: int = 15) -> bool:
    """Pass B: Scan top N rows of the sheet for specific keywords."""
    for row in rows[:num_rows]:
        for cell in row:
            if not cell: continue
            cell_str = str(cell).lower()
            if any(kw in cell_str for kw in keywords):
                return True
    return False

def _identify_sheet_type_pass_ab(sheet_name: str, rows: List[List[Any]], target_certificate: str) -> str:
    """
    Pass A & B: Identifies candidate sheets based on title and top rows.
    Returns: 'ipc_summary', 'advance_recovery', 'boq_grand_summary', or 'unknown'
    """
    sheet_name_lower = sheet_name.lower()
    
    # 1. Advance Recovery Checks
    if any(kw in sheet_name_lower for kw in ADVANCE_RECOVERY_KEYWORDS):
        return 'advance_recovery'
    if _search_keywords_in_rows(rows, ADVANCE_RECOVERY_KEYWORDS):
        return 'advance_recovery'
        
    # 2. BoQ Grand Summary Checks
    if any(kw in sheet_name_lower for kw in BOQ_GRAND_SUMMARY_KEYWORDS):
        return 'boq_grand_summary'
    if _search_keywords_in_rows(rows, BOQ_GRAND_SUMMARY_KEYWORDS):
        return 'boq_grand_summary'
        
    # 3. Main IPC Summary Checks (Must contain IPC keyword and match certificate number potentially)
    # This is a bit looser in Pass A/B, AI will confirm in Pass C.
    if any(kw in sheet_name_lower for kw in IPC_SUMMARY_KEYWORDS) or target_certificate.lower() in sheet_name_lower:
        return 'ipc_summary'
    if _search_keywords_in_rows(rows, IPC_SUMMARY_KEYWORDS):
        return 'ipc_summary'
        
    return 'unknown'

async def ai_verify_sheet_content(sheet_type: str, sheet_name: str, rows: List[List[Any]], target_certificate: str) -> bool:
    """
    Pass C: AI Content & Certificate Matching
    Calls a lightweight LLM prompt to verify if this sheet actually represents the sheet_type
    and specifically for the target_certificate.
    """
    # Stub for now, in reality this would use google.genai or similar.
    # The prompt would pass the first ~30 rows and ask:
    # "Does this matrix represent a {sheet_type} for Certificate No. {target_certificate}?"
    return True 

def extract_system_matrix(rows: List[List[Any]]) -> List[Dict[str, Any]]:
    """
    System Matrix Reader: Converts raw cell matrices into structured layout grids.
    This will strip out completely empty rows and columns to create a dense representation.
    """
    dense_matrix = []
    for r_idx, row in enumerate(rows):
        # Skip completely empty rows
        if not any(str(cell).strip() for cell in row):
            continue
        row_data = {"row_index": r_idx, "cells": []}
        for c_idx, cell in enumerate(row):
            val = str(cell).strip() if cell is not None else ""
            if val:
                row_data["cells"].append({"col_index": c_idx, "value": val})
        dense_matrix.append(row_data)
    return dense_matrix

async def scan_and_classify_ipc_sheets(sheets_data: Dict[str, List[List[Any]]], target_certificate: str) -> Dict[str, Any]:
    """
    Main entry point for Phase 2 sheet scanner.
    sheets_data: Dict of sheet_name -> List of rows (cell matrix)
    """
    classification_results = {
        "ipc_summary": {"found": False, "sheet_name": None, "matrix": None},
        "advance_recovery": {"found": False, "sheet_name": None, "matrix": None},
        "boq_grand_summary": {"found": False, "sheet_name": None, "matrix": None},
        "is_ipc_document": False
    }

    # Pass A & B: Keyword lookup for candidates
    candidates = {"ipc_summary": [], "advance_recovery": [], "boq_grand_summary": []}
    
    for sheet_name, rows in sheets_data.items():
        if not rows: continue
        inferred_type = _identify_sheet_type_pass_ab(sheet_name, rows, target_certificate)
        if inferred_type != 'unknown':
            candidates[inferred_type].append((sheet_name, rows))

    # Pass C: AI Verification and Selection
    for sheet_type in ["ipc_summary", "advance_recovery", "boq_grand_summary"]:
        for sheet_name, rows in candidates[sheet_type]:
            is_verified = await ai_verify_sheet_content(sheet_type, sheet_name, rows, target_certificate)
            if is_verified:
                classification_results[sheet_type]["found"] = True
                classification_results[sheet_type]["sheet_name"] = sheet_name
                classification_results[sheet_type]["matrix"] = extract_system_matrix(rows)
                break # Only take the first verified sheet for each type
                
    # Document is valid if at least the Main IPC Summary is found
    if classification_results["ipc_summary"]["found"]:
        classification_results["is_ipc_document"] = True
        
    return classification_results
