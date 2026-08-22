import logging
from typing import Dict, Any, List, Optional
import json
from pydantic import BaseModel, Field
from ..ai_client import generate_text

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for Milestone Claim AI Extraction ---

class MilestoneClaimExtractionItem(BaseModel):
    activity_id: Optional[str] = Field(description="The activity item number/code (e.g. '1.1', 'A.2'). Null if not found.")
    description: str = Field(description="The detailed description of the activity/work.")
    percentage_complete_this_period: float = Field(default=0.0, description="The percentage of work completed this period (0-100%).")
    amount_claimed_this_period: float = Field(default=0.0, description="The monetary amount claimed for this activity in this period.")
    values_map: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A JSON dictionary capturing any other relevant columns or data points present in this row (e.g., 'Previous Claim', 'Total to Date').")

class MilestoneClaimSummaryMetrics(BaseModel):
    gross_amount_claimed: float = Field(default=0.0, description="Total gross valuation/claim amount before deductions.")
    retention_deducted: float = Field(default=0.0, description="Total retention amount deducted.")
    net_amount_due: float = Field(default=0.0, description="Net payment amount due after retention and other deductions.")
    values_map: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A JSON dictionary capturing raw document header/footer metrics (e.g. 'Less 10% Tax', 'Advance Recovery').")

class FullMilestoneClaimExtraction(BaseModel):
    is_milestone_document: bool = Field(description="True if this document represents a milestone payment claim, valuation, or application for payment.")
    identified_document_type: str = Field(default="Unknown", description="A brief 2-4 word summary classification based entirely on the contents of the document (e.g., 'HR Roster', 'Milestone Claim', 'Design Drawing').")
    column_mapping: Dict[str, str] = Field(default_factory=dict, description="A dictionary mapping the strict fields ('activity_id', 'percentage_complete_this_period', 'amount_claimed_this_period') to the exact raw column names found in the Excel document.")
    metrics: MilestoneClaimSummaryMetrics
    items: List[MilestoneClaimExtractionItem] = Field(default_factory=list)
    validation_status: str = Field(default="VALID", description="VALID, WARNING, or INVALID")
    validation_score: float = Field(default=1.0, description="Confidence score from 0.0 to 1.0")
    validation_issues: List[str] = Field(default_factory=list)

def _format_sheets_for_prompt(sheets_data: Dict[str, List[List[Any]]]) -> str:
    output = []
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
        selected_indices = set()
        
        # Top 250 rows
        for i in range(min(250, total_dense)):
            selected_indices.add(i)
            
        # Bottom 100 non-empty rows
        for i in range(max(0, total_dense - 100), total_dense):
            selected_indices.add(i)
            
        sorted_indices = sorted(selected_indices)
        
        last_idx = -1
        for idx in sorted_indices:
            if last_idx != -1 and idx > last_idx + 1:
                skipped_count = idx - last_idx - 1
                output.append(f"... [skipped {skipped_count} intermediate rows with values] ...")
            original_row_num, row_str = dense_rows[idx]
            output.append(f"Row {original_row_num}: {row_str}")
            last_idx = idx
            
        output.append("\n")
    return "\n".join(output)

async def process_milestone_claim_with_ai(
    sheets_data: Optional[Dict[str, List[List[Any]]]] = None,
    text_content: Optional[str] = None,
    file_path: Optional[str] = None,
    mime_type: Optional[str] = None,
    project_name: str = ""
) -> Dict[str, Any]:
    """
    Holistic AI validation & extraction for Milestone Claims.
    Supports spreadsheets data, raw text, or PDF visual/binary files.
    """
    schema_json = FullMilestoneClaimExtraction.model_json_schema()
    
    # Format the data depending on input
    if file_path and mime_type == "application/pdf":
        formatted_data = "Attached PDF document."
    elif text_content:
        formatted_data = text_content
    elif sheets_data:
        formatted_data = _format_sheets_for_prompt(sheets_data)
    else:
        formatted_data = "No file data provided."

    prompt = f"""
    You are an expert Construction Quantity Surveyor and Financial Auditor AI.
    Analyze this document with extreme precision to extract a structured Milestone Payment Claim or Valuation.
    
    Active Project Context: {project_name}
    
    CRITICAL HOLISTIC SEMANTIC REASONING:
    1. **Strict Positive Qualification**:
       - Set `is_milestone_document = true` ONLY if the document primarily outlines a contractor's claim for payment, a valuation of work done, or a milestone completion certificate.
       - If it is an HR Roster, a generic schedule, or just a drawing, set `is_milestone_document = false` and classify it in `identified_document_type`.
       
    2. **ETL Extraction Rules (Rows)**:
       - For every activity row, extract **EVERY SINGLE COLUMN** exactly as it appears in the document into the `values_map` dictionary (e.g., `{{"Item No": "1.0", "Scope of Work": "Roofing", "Claimed Amount": 5000}}`).
       - Then, map the specific required fields based on the raw columns you found:
         * activity_id: The item reference number (e.g. '1.1', 'A.2').
         * description: Detailed summary of works for this activity.
         * percentage_complete_this_period: Percentage of work claimed in this period (0-100%).
         * amount_claimed_this_period: Monetary amount claimed for this activity.
       - Normalize all numeric values as standard floats for the main fields.
       - Populate `column_mapping` at the top level with exactly how you mapped the strict fields to the raw column headers (e.g., `{{"amount_claimed_this_period": "Claimed Amount"}}`).
       
    3. **ETL Extraction Rules (Cover Page / Header Metrics)**:
       - Extract the overall document financial totals into `metrics`.
       - Dump all raw header/footer financial lines (like 'Less 10% Retention', 'Total Valuation to Date', 'Advance Recovery') into the `metrics.values_map` so nothing is lost.
       - Map the final strict values for `gross_amount_claimed`, `retention_deducted`, and `net_amount_due`.
       
    Return your analysis STRICTLY as a VALID JSON OBJECT. DO NOT output the schema itself. Only output the actual extracted data following the schema structure:
    {json.dumps(schema_json, indent=2)}
    Document Data:
    ---
    {formatted_data}
    ---
    """
    
    # Call Gemini
    response = await generate_text(prompt, file_path=file_path, mime_type=mime_type, force_pro=True)
    
    if "error" in response:
        logger.error(f"AI Milestone Claim Extraction failed: {response['error']}")
        return {
            "is_milestone_document": False,
            "identified_document_type": "Error",
            "metrics": {
                "gross_amount_claimed": 0.0,
                "retention_deducted": 0.0,
                "net_amount_due": 0.0,
                "values_map": {}
            },
            "items": [],
            "validation_status": "INVALID",
            "validation_score": 0.0,
            "validation_issues": [f"AI service error: {response['error']}"]
        }
        
    raw_text = response.get("text", "")
    try:
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```json"): cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"): cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"): cleaned_text = cleaned_text[:-3]
        
        validated_data = FullMilestoneClaimExtraction.model_validate_json(cleaned_text.strip())
        result_dict = validated_data.model_dump()
        
        # Mathematical checks to append issues
        issues = []
        items = result_dict.get("items", [])
        metrics = result_dict.get("metrics", {})
        
        calc_total_amount = sum(item.get("amount_claimed_this_period") or 0.0 for item in items)
        
        # If metrics total doesn't match sum of items
        gross = metrics.get("gross_amount_claimed", 0.0)
        retention = metrics.get("retention_deducted", 0.0)
        net = metrics.get("net_amount_due", 0.0)
        
        if abs(calc_total_amount - gross) > 10.0 and abs(calc_total_amount - net) > 10.0:
            issues.append(f"Sum of items is ${calc_total_amount:,.2f}, which doesn't perfectly match gross (${gross:,.2f}) or net (${net:,.2f}) totals.")
            result_dict["validation_status"] = "WARNING"
            
        if abs((gross - retention) - net) > 10.0:
            issues.append(f"Math warning: Gross (${gross:,.2f}) minus Retention (${retention:,.2f}) does not equal Net Due (${net:,.2f}).")
            result_dict["validation_status"] = "WARNING"
            
        result_dict["validation_issues"] = issues
        return result_dict
        
    except Exception as e:
        logger.error(f"Failed to parse AI Milestone Claim response: {e}")
        return {
            "is_milestone_document": False,
            "identified_document_type": "JSON Parsing Error",
            "metrics": {
                "gross_amount_claimed": 0.0,
                "retention_deducted": 0.0,
                "net_amount_due": 0.0,
                "values_map": {}
            },
            "items": [],
            "validation_status": "INVALID",
            "validation_score": 0.0,
            "validation_issues": [f"Failed to parse JSON response: {str(e)}"]
        }
