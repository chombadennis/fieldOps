import logging
from typing import Dict, Any, List, Optional
import json
from pydantic import BaseModel, Field
from ..ai_client import generate_text

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for Budget AI Extraction ---

class CategoryBreakdownItem(BaseModel):
    category_name: str = Field(description="Name of summary section or Bill category (e.g. Substructure, Superstructure, Services)")
    original_amount: float = Field(default=0.0, description="Initial baseline contract amount for this category")
    appraised_amount: Optional[float] = Field(default=None, description="Appraised or revised contract amount for this category if updated")
    earned_value_to_date: float = Field(default=0.0, description="Value of work executed/earned to date for this category")
    appraisal_delta: float = Field(default=0.0, description="Variance between appraised and original amount")
    is_appraised: bool = Field(default=False, description="True if category budget was revised or appraised")

class BudgetSummaryMetrics(BaseModel):
    original_contract_sum: float = Field(default=0.0, description="Total initial approved baseline budget")
    appraised_budget: Optional[float] = Field(default=None, description="Total appraised or revised contract budget")
    earned_value: float = Field(default=0.0, description="Total value of work executed/earned to date")
    remaining_balance: float = Field(default=0.0, description="Unearned or remaining budget balance")
    percent_used: float = Field(default=0.0, description="Percentage of contract sum consumed")
    is_appraised: bool = Field(default=False, description="True if total contract sum has been appraised")

class BudgetProjectMetadata(BaseModel):
    extracted_project_name: Optional[str] = Field(default=None, description="Project title found in header")
    extracted_client_name: Optional[str] = Field(default=None, description="Client name found in header")
    trade_label: Optional[str] = Field(default=None, description="Trade discipline: Builders, Electrical, Mechanical, Civil, Plumbing")

class FullBudgetExtraction(BaseModel):
    is_budget_document: bool = Field(description="True if this Excel file contains Budget / EVM summary data.")
    identified_document_type: str = Field(default="Unknown", description="A brief 2-4 word summary classification based entirely on the contents of the rows read (e.g., 'HR Timesheet', 'Employee Roster', 'Catering Menu', 'Blank Spreadsheet').")
    summary_sheet_name: Optional[str] = Field(description="The name of the summary sheet identified in the workbook")
    project_metadata: BudgetProjectMetadata = Field(default_factory=BudgetProjectMetadata)
    metrics: BudgetSummaryMetrics
    categories: List[CategoryBreakdownItem] = Field(default_factory=list)
    validation_status: str = Field(default="VALID", description="VALID, WARNING, or INVALID")
    validation_score: float = Field(default=1.0, description="Confidence score from 0.0 to 1.0")
    validation_issues: List[str] = Field(default_factory=list)

# --- End Pydantic Schemas ---

def _format_sheets_for_prompt(sheets_data: Dict[str, List[List[Any]]]) -> str:
    """
    Smart Whole-Sheet Summary Extractor:
    - If sheet has <= 300 non-empty rows, passes 100% of the sheet to the AI prompt.
    - If sheet > 300 rows, extracts top 60 rows, bottom 60 rows, AND all summary/total rows across the entire sheet depth.
    Guarantees summary numbers are never missed regardless of where they live on the sheet.
    """
    output = []
    summary_keywords = (
        "total", "contract", "budget", "appraised", "earned", "summary",
        "subtotal", "carried", "brought", "vop", "variation", "net", "gross",
        "value", "balance", "amount", "preliminaries", "substructure", "superstructure"
    )

    for sheet_name, rows in sheets_data.items():
        output.append(f"=== SHEET NAME: {sheet_name} ===")
        dense_rows = []
        for r_idx, r in enumerate(rows):
            cell_strs = [str(c).strip() for c in r if str(c).strip()]
            if not cell_strs:
                continue
            line = " | ".join(cell_strs)
            dense_rows.append((r_idx + 1, line))
            
        total_dense = len(dense_rows)
        if total_dense <= 300:
            # Short to medium sheet: Pass 100% of rows to AI
            for original_row_num, row_str in dense_rows:
                output.append(f"Row {original_row_num}: {row_str}")
        else:
            # Large sheet: Smart extraction (Top 60 + Bottom 60 + Summary Keyword Rows)
            selected_indices = set()
            
            # Top 60 non-empty rows
            for i in range(min(60, total_dense)):
                selected_indices.add(i)
                
            # Bottom 60 non-empty rows
            for i in range(max(0, total_dense - 60), total_dense):
                selected_indices.add(i)
                
            # Keyword matching rows across entire sheet
            for i, (row_num, row_str) in enumerate(dense_rows):
                row_lower = row_str.lower()
                if any(kw in row_lower for kw in summary_keywords):
                    selected_indices.add(i)

            sorted_indices = sorted(selected_indices)
            for i in sorted_indices:
                row_num, row_str = dense_rows[i]
                output.append(f"Row {row_num}: {row_str}")

        output.append("\n")
    return "\n".join(output)

async def process_budget_with_ai(sheets_data: Dict[str, List[List[Any]]], contract_name: str = "", trade_label: str = None) -> Dict[str, Any]:
    """
    Holistic AI classification and extraction for Budget & EVM summary sheets.
    Samples the first 150 rows of each sheet, uses semantic alias matching,
    extracts top-level metrics AND itemized category appraisals, and validates.
    """
    schema_json = FullBudgetExtraction.model_json_schema()
    formatted_data = _format_sheets_for_prompt(sheets_data)
    
    prompt = f"""
    You are an expert Construction Quantity Surveyor and Financial Data Extraction system.
    I am providing you with the contents of an Excel workbook containing multiple sheets.
    
    Active Contract Context: {contract_name}
    Expected Trade Discipline / Label: {trade_label or 'Not specified'}
    
    CRITICAL HOLISTIC SEMANTIC REASONING:
    1. **Strict Positive Qualification & Exclusion Principles**:
       - Default `is_budget_document` to `false`.
       - To set `is_budget_document = true`, you MUST affirmatively verify that the document's primary structural purpose is ONE of the following three PMO functions:
         a) **Project Budget**: Master baseline allocations, target cost models, or revised/appraised budget schedules.
         b) **Work Progress Calculations**: Earned value tracking, work progress measurement schedules, or cumulative work done calculations across trade packages.
         c) **Cost Tracking**: Financial cost tracking overviews, committed expenditure schedules, or cost vs. budget variance tracking.
         
       - **EXPLICIT REINFORCED EXCLUSIONS (Always set `is_budget_document = false` for these)**:
         * **IPC / Payment Certificates**: Interim Valuation claims, contractor payment certificates, net payment now due, retentions, or valuation certificates are billing documents, NOT budgets or progress calculation overviews -> Set `is_budget_document = false` and `identified_document_type = "Interim Payment Certificate (IPC)"`.
         * **Detailed Bills of Quantities (BoQ)**: Line-by-line itemized measure schedules with granular item numbers and unit rates are BoQs, NOT budget summaries. (Note: Progress tracking or EVM spreadsheets often contain summary rows for trade categories and quantities to calculate cumulative progress. Do NOT reject a document as a 'Detailed BoQ' if its primary purpose is tracking earned value, cost-to-complete, or budget progress over time). If it is a raw, non-progress measure sheet, set `is_budget_document = false` and `identified_document_type = "Detailed Bill of Quantities (BoQ)"`.
         * **Invoices / POs / Receipts**: Vendor invoices, tax receipts, or purchase orders -> Set `is_budget_document = false` and `identified_document_type = "Vendor Invoice / PO"`.
         * **Other Non-Budget Files, non- work progress calculations or non cost tracking file**: Architectural logs, safety checklists, HR rosters, timesheets, site memos, etc -> Set `is_budget_document = false`.

       - Whenever `is_budget_document` is `false`, summarize what the document actually is in `identified_document_type` using a concise 2-4 word classification (e.g. "IPC Payment Certificate", "Detailed BoQ", "Vendor Invoice", "HR Timesheet").
         
    2. **If `is_budget_document` is true, extract the metrics and breakdown**:
       - Look for cell concepts matching:
         * original_contract_sum: Total baseline initial budget allocation
         * appraised_budget: Revised or appraised target budget if updated (or null if unchanged)
         * earned_value: Total value of work executed/earned to date
         * remaining_balance: Unused balance (appraised_budget - earned_value, or original_contract_sum - earned_value)
         * percent_used: Percentage consumed ((earned_value / contract_sum) * 100)
       - Extract category breakdowns for major summary sections (e.g., Preliminaries, Civil Works, Services).
       
    3. **Data Normalization & Rules**:
       - Convert all numbers into standard floats (e.g. 1500000.00). Remove currency symbols and commas.
       - If a value is missing or "Nil", use 0.0.
       
    Return your analysis STRICTLY as VALID JSON matching this schema:
    {json.dumps(schema_json, indent=2)}
    
    Workbook Data (first 150 rows per sheet):
    ---
    {formatted_data}
    ---
    """
    
    response = await generate_text(prompt, force_pro=True)
    
    if "error" in response:
        logger.error(f"AI Budget Extraction failed: {response['error']}")
        return {
            "is_budget_document": False,
            "summary_sheet_name": None,
            "metrics": {
                "original_contract_sum": 0.0,
                "appraised_budget": None,
                "earned_value": 0.0,
                "remaining_balance": 0.0,
                "percent_used": 0.0,
                "is_appraised": False
            },
            "categories": [],
            "validation_status": "INVALID",
            "validation_score": 0.0,
            "validation_issues": [f"AI extraction error: {response['error']}"]
        }
        
    raw_text = response.get("text", "")
    try:
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```json"): cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"): cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"): cleaned_text = cleaned_text[:-3]
        
        validated_data = FullBudgetExtraction.model_validate_json(cleaned_text.strip())
        result_dict = validated_data.model_dump()
        
        # Mathematical Validation Check
        issues = []
        metrics = result_dict.get("metrics", {})
        c_sum = metrics.get("appraised_budget") or metrics.get("original_contract_sum") or 0.0
        ev = metrics.get("earned_value") or 0.0
        rem = metrics.get("remaining_balance") or 0.0
        
        if c_sum > 0:
            calc_rem = c_sum - ev
            if abs(calc_rem - rem) > 10.0: # allow rounding tolerance
                issues.append(f"Remaining balance mismatch: Spreadsheet shows ${rem:,.2f}, calculated is ${calc_rem:,.2f}")
                result_dict["validation_status"] = "WARNING"
                result_dict["validation_score"] = 0.85
        else:
            issues.append("Contract sum is zero or missing.")
            result_dict["validation_status"] = "WARNING"
            result_dict["validation_score"] = 0.7
            
        result_dict["validation_issues"] = issues
        return result_dict
        
    except Exception as e:
        logger.error(f"Failed to parse AI Budget extraction response: {e}")
        return {
            "is_budget_document": False,
            "summary_sheet_name": None,
            "metrics": {
                "original_contract_sum": 0.0,
                "appraised_budget": None,
                "earned_value": 0.0,
                "remaining_balance": 0.0,
                "percent_used": 0.0,
                "is_appraised": False
            },
            "categories": [],
            "validation_status": "INVALID",
            "validation_score": 0.0,
            "validation_issues": [f"JSON parsing error: {str(e)}"]
        }

async def reconcile_master_bundle_ai(master_bundle_matrix: List[Dict[str, Any]], active_project_name: str = "") -> Dict[str, Any]:
    """
    AI Cross-Workbook Reconciliation Engine:
    Analyzes all individual JSON matrices in master_bundle_matrix holistically.
    Detects copy-pasted category totals referenced across workbooks, deduplicates trade overlaps,
    verifies project name alignment, and generates the single cleaned-up Master Budget Table.
    """
    if not master_bundle_matrix:
        return {
            "original_contract_sum": 0.0,
            "appraised_budget": None,
            "earned_value": 0.0,
            "remaining_balance": 0.0,
            "percent_used": 0.0,
            "reconciled_categories": [],
            "detected_overlaps": []
        }

    # If only 1 workbook linked, return its metrics directly as master cleaned table
    if len(master_bundle_matrix) == 1:
        single = master_bundle_matrix[0]
        metrics = single.get("summary_metrics") or single.get("metrics") or {}
        cats = single.get("categories") or []
        orig = metrics.get("original_contract_sum") or 0.0
        appr = metrics.get("appraised_budget")
        ev = metrics.get("earned_value") or 0.0
        eff = appr if (appr is not None and appr > 0) else orig
        rem = max(0.0, eff - ev)
        pct = (ev / eff * 100.0) if eff > 0 else 0.0

        return {
            "original_contract_sum": orig,
            "appraised_budget": appr,
            "earned_value": ev,
            "remaining_balance": rem,
            "percent_used": pct,
            "reconciled_categories": cats,
            "detected_overlaps": []
        }

    prompt = f"""
    You are an expert Quantity Surveyor and Construction Data Reconciliation AI.
    I am providing you with the extracted JSON summaries from multiple linked trade workbooks for project: {active_project_name}.
    
    Workbooks Data Matrix:
    {json.dumps(master_bundle_matrix, indent=2)}
    
    CRITICAL INSTRUCTIONS:
    1. **Detect Overlaps & Copy-Pasted Summaries**:
       Check if summary category totals from one workbook (e.g. Electrical Works) are already included or referenced inside the summary rows of another workbook (e.g. Master Builders Cover Sheet).
       DO NOT blindly sum duplicate categories. Reconcile and deduplicate so each trade scope is counted exactly ONCE.

    2. **Calculate Master Cleaned Totals**:
       - Calculate total deduplicated original_contract_sum.
       - Calculate total deduplicated appraised_budget (or null if no revisions).
       - Calculate total deduplicated earned_value.
       - Calculate remaining_balance = effective_budget - earned_value.
       - Calculate percent_used = (earned_value / effective_budget) * 100.

    3. **Generate Reconciled Categories List**:
       Provide a clean list of deduplicated category breakdown objects:
       [
         {{
           "category_name": "...",
           "original_amount": 0.0,
           "appraised_amount": 0.0,
           "earned_value_to_date": 0.0,
           "source_trade": "...",
           "is_reconciled": true
         }}
       ]

    4. **List Detected Overlaps**:
       Provide a human-readable list of string explanations describing any deduplicated overlaps (e.g. "Electrical Works summary ($400M) in Workbook 2 was detected inside Builders Cover Sheet and deduplicated.").

    Return STRICTLY as VALID JSON matching this structure:
    {{
      "original_contract_sum": float,
      "appraised_budget": float or null,
      "earned_value": float,
      "remaining_balance": float,
      "percent_used": float,
      "reconciled_categories": list of category objects,
      "detected_overlaps": list of string explanation notices
    }}
    """

    response = await generate_text(prompt, force_pro=True)
    if "error" in response:
        logger.error(f"AI Master Bundle Reconciliation failed: {response['error']}")
        # Fallback to simple non-duplicating sum
        return _fallback_bundle_reconciliation(master_bundle_matrix)

    raw_text = response.get("text", "")
    try:
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```json"): cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"): cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"): cleaned_text = cleaned_text[:-3]

        return json.loads(cleaned_text.strip())
    except Exception as e:
        logger.error(f"Failed to parse AI bundle reconciliation response: {e}")
        return _fallback_bundle_reconciliation(master_bundle_matrix)

def _fallback_bundle_reconciliation(master_bundle_matrix: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Fallback consolidation if LLM reconciliation API call fails."""
    tot_orig = 0.0
    tot_appr = 0.0
    tot_ev = 0.0
    all_cats = []
    seen_names = set()

    for wb in master_bundle_matrix:
        m = wb.get("summary_metrics") or wb.get("metrics") or {}
        tot_orig += m.get("original_contract_sum") or 0.0
        tot_appr += m.get("appraised_budget") or m.get("original_contract_sum") or 0.0
        tot_ev += m.get("earned_value") or 0.0

        for c in wb.get("categories") or []:
            c_name = c.get("category_name", "").strip()
            if c_name and c_name.lower() not in seen_names:
                seen_names.add(c_name.lower())
                all_cats.append(c)

    eff = tot_appr if tot_appr > 0 else tot_orig
    rem = max(0.0, eff - tot_ev)
    pct = (tot_ev / eff * 100.0) if eff > 0 else 0.0

    return {
        "original_contract_sum": tot_orig,
        "appraised_budget": tot_appr if tot_appr != tot_orig else None,
        "earned_value": tot_ev,
        "remaining_balance": rem,
        "percent_used": pct,
        "reconciled_categories": all_cats,
        "detected_overlaps": ["Consolidated using standard non-duplicate category merging."]
    }

