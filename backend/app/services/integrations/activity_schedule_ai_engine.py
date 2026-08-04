import logging
from typing import Dict, Any, List, Optional
import json
from pydantic import BaseModel, Field
from ..ai_client import generate_text

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for Activity Schedule AI Extraction ---

class ActivityScheduleExtractionItem(BaseModel):
    activity_id: Optional[str] = Field(description="The activity item number/code (e.g. '1.1', 'A.2'). Null if not found.")
    description: str = Field(description="The detailed description of the activity.")
    weight_percentage: float = Field(default=0.0, description="The weight percentage of the activity (0-100%).")
    fixed_price: float = Field(default=0.0, description="The contract fixed price for this activity.")
    values_map: Optional[Dict[str, Any]] = Field(default_factory=dict, description="A JSON dictionary capturing any other relevant columns or data points present in this row (e.g., 'Start Date', 'Duration', 'Remarks').")

class ActivityScheduleSummaryMetrics(BaseModel):
    total_activities: int = Field(default=0, description="Total count of activities identified.")
    total_weight_percentage: float = Field(default=0.0, description="Sum of weight percentages of all activities (expected to be near 100.0%).")
    total_price: float = Field(default=0.0, description="Sum of fixed prices of all activities.")

class FullActivityScheduleExtraction(BaseModel):
    is_activity_schedule_document: bool = Field(description="True if this document contains an Activity Schedule or Milestones/Payment Schedule.")
    identified_document_type: str = Field(default="Unknown", description="A brief 2-4 word summary classification based entirely on the contents of the document (e.g., 'HR Roster', 'Interim Payment Certificate', 'Detailed BoQ').")
    column_mapping: Dict[str, str] = Field(default_factory=dict, description="A dictionary mapping the strict fields ('activity_id', 'description', 'weight_percentage', 'fixed_price') to the exact raw column names found in the Excel document.")
    metrics: ActivityScheduleSummaryMetrics
    items: List[ActivityScheduleExtractionItem] = Field(default_factory=list)
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

async def process_activity_schedule_with_ai(
    sheets_data: Optional[Dict[str, List[List[Any]]]] = None,
    text_content: Optional[str] = None,
    file_path: Optional[str] = None,
    mime_type: Optional[str] = None,
    project_name: str = ""
) -> Dict[str, Any]:
    """
    Holistic AI validation & extraction for Activity Schedules.
    Supports spreadsheets data, raw text (like extracted from docx), or PDF visual/binary files.
    """
    schema_json = FullActivityScheduleExtraction.model_json_schema()
    
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
    You are an expert Construction Project Scheduler and Financial Auditor AI.
    Analyze this document with extreme precision to extract a structured Activity Schedule.
    
    Active Project Context: {project_name}
    
    CRITICAL HOLISTIC SEMANTIC REASONING:
    1. **Strict Positive Qualification**:
       - Set `is_activity_schedule_document = true` ONLY if the document primarily outlines a baseline schedule of activities, milestones, weightings, or payment allocations.
       - If it is a Detailed Bill of Quantities (BoQ) with granular measure descriptions and unit rates, or if it is an Interim Payment Certificate (IPC), mark `is_activity_schedule_document = false` and classify it in `identified_document_type`.
       
    2. **ETL Extraction Rules**:
       - For every activity row, extract **EVERY SINGLE COLUMN** exactly as it appears in the document into the `values_map` dictionary (e.g., `{{"Item No": "1.0", "Scope of Work": "Roofing", "Amount": 5000}}`).
       - Then, map the specific required fields based on the raw columns you found:
         * activity_id: The item reference number (e.g. '1.1', 'A.2').
         * description: Detailed summary of works for this activity.
         * weight_percentage: Allocated weighting (0-100%).
         * fixed_price: Fixed amount allocated to the activity.
       - Normalize all numeric values as standard floats for the main fields (remove currency symbols, commas, percent signs).
       - VERY IMPORTANT: Populate `column_mapping` at the top level with exactly how you mapped the strict fields to the raw column headers (e.g., `{{"activity_id": "Item No", "fixed_price": "Amount"}}`).
       
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
        logger.error(f"AI Activity Schedule Extraction failed: {response['error']}")
        return {
            "is_activity_schedule_document": False,
            "identified_document_type": "Error",
            "metrics": {
                "total_activities": 0,
                "total_weight_percentage": 0.0,
                "total_price": 0.0
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
        
        validated_data = FullActivityScheduleExtraction.model_validate_json(cleaned_text.strip())
        result_dict = validated_data.model_dump()
        
        # Mathematical checks to append issues
        issues = []
        items = result_dict.get("items", [])
        metrics = result_dict.get("metrics", {})
        
        calc_total_price = sum(item.get("fixed_price") or 0.0 for item in items)
        calc_total_weight = sum(item.get("weight_percentage") or 0.0 for item in items)
        
        # If metrics total doesn't match sum of items
        if abs(calc_total_price - metrics.get("total_price", 0.0)) > 10.0:
            issues.append(f"Fixed price mismatch: Sum of items is ${calc_total_price:,.2f}, total in metrics is ${metrics.get('total_price', 0.0):,.2f}")
            result_dict["validation_status"] = "WARNING"
            
        if abs(calc_total_weight - metrics.get("total_weight_percentage", 0.0)) > 1.0:
            issues.append(f"Weight percentage mismatch: Sum of items is {calc_total_weight}%, total in metrics is {metrics.get('total_weight_percentage', 0.0)}%")
            result_dict["validation_status"] = "WARNING"
            
        result_dict["validation_issues"] = issues
        return result_dict
        
    except Exception as e:
        logger.error(f"Failed to parse AI Activity Schedule response: {e}")
        return {
            "is_activity_schedule_document": False,
            "identified_document_type": "JSON Parsing Error",
            "metrics": {
                "total_activities": 0,
                "total_weight_percentage": 0.0,
                "total_price": 0.0
            },
            "items": [],
            "validation_status": "INVALID",
            "validation_score": 0.0,
            "validation_issues": [f"Failed to parse JSON response: {str(e)}"]
        }
