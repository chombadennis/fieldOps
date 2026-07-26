import logging
from typing import Dict, Any, List, Optional
import json
from pydantic import BaseModel, Field
from ..ai_client import generate_text

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for AI Extraction ---

class IpcFinancialMetrics(BaseModel):
    gross_amount_claimed: float = Field(default=0.0)
    gross_amount_certified: float = Field(default=0.0)
    materials_on_site: float = Field(default=0.0)
    price_variation: float = Field(default=0.0)
    vat_amount: float = Field(default=0.0)
    retention_deducted: float = Field(default=0.0)
    advance_recovered: float = Field(default=0.0)
    withholding_tax: float = Field(default=0.0)
    withholding_vat: float = Field(default=0.0)
    total_deductions: float = Field(default=0.0)
    net_amount_due: float = Field(default=0.0)

class RawBreakdownItem(BaseModel):
    description: str = Field(description="Description of the row item")
    amount: float = Field(default=0.0)

class AdvanceRecoveryItem(BaseModel):
    description: str = Field(description="Description of advance recovery row")
    amount: float = Field(default=0.0)

class BoqSummaryItem(BaseModel):
    bill_no: str = Field(description="Bill number")
    description: str = Field(description="Description of the bill")
    tender_amount: float = Field(default=0.0)
    total_to_date: float = Field(default=0.0)

class IpcSummaryData(BaseModel):
    found: bool = Field(description="True if the Main IPC Summary sheet was found in the document")
    sheet_name: Optional[str] = Field(description="The name of the sheet in the workbook")
    metrics: IpcFinancialMetrics
    raw_breakdown: List[RawBreakdownItem] = Field(default_factory=list)

class AdvanceRecoveryData(BaseModel):
    found: bool = Field(description="True if the Advance Recovery sheet was found")
    sheet_name: Optional[str] = Field(description="The name of the sheet in the workbook")
    metrics: Dict[str, float] = Field(default_factory=dict)
    raw_breakdown: List[AdvanceRecoveryItem] = Field(default_factory=list)

class BoqGrandSummaryData(BaseModel):
    found: bool = Field(description="True if the BoQ Grand Summary sheet was found")
    sheet_name: Optional[str] = Field(description="The name of the sheet in the workbook")
    data: List[BoqSummaryItem] = Field(default_factory=list)

class FullIpcExtraction(BaseModel):
    is_ipc_document: bool = Field(description="True if this Excel file appears to contain IPC data.")
    ipc_summary: IpcSummaryData
    advance_recovery: AdvanceRecoveryData
    boq_grand_summary: BoqGrandSummaryData

# --- End Pydantic Schemas ---

def _format_sheets_for_prompt(sheets_data: Dict[str, List[List[Any]]]) -> str:
    """Takes the dense sheets and formats them into a readable text block for the prompt."""
    output = []
    for sheet_name, rows in sheets_data.items():
        output.append(f"=== SHEET NAME: {sheet_name} ===")
        # We only pass the first 35 non-empty rows to keep context window tight but enough to see the grid
        dense_rows = []
        for r in rows:
            if not any(str(c).strip() for c in r): continue
            dense_rows.append(" | ".join(str(c).strip() for c in r if str(c).strip()))
            
        for idx, row_str in enumerate(dense_rows[:35]):
            output.append(f"Row {idx+1}: {row_str}")
        output.append("\n")
    return "\n".join(output)

async def process_ipc_with_ai(sheets_data: Dict[str, List[List[Any]]], target_certificate: str) -> Dict[str, Any]:
    """
    Holistic AI classification and extraction.
    Takes all sheet matrices and asks the AI to identify which is which and extract the data into a strict JSON schema.
    """
    schema_json = FullIpcExtraction.model_json_schema()
    
    formatted_data = _format_sheets_for_prompt(sheets_data)
    
    prompt = f"""
    You are an expert Construction Quantity Surveyor and Data Extraction AI.
    I am providing you with the contents of an Excel workbook containing multiple sheets.
    Your job is to look at the content of these sheets holistically, identify which sheet serves which purpose, and extract the financial data.
    
    The target IPC Certificate Number is: {target_certificate}
    
    CRITICAL INSTRUCTIONS:
    1. **Identify the Sheets**: Look at the structural layout and content of the grids.
       - "Main IPC Summary": Look for gross amounts, retentions, VAT, net amount due.
       - "Advance Recovery": Look for deductions or recovery of advance payments.
       - "BoQ Grand Summary": Look for a list of bills (Bill 1, Bill 2, etc.) and their total amounts to date.
       Even if the sheet names are abbreviations (e.g. 'Sum', 'Adv', 'GS'), identify them by their actual cell contents!
    
    2. **Financial Metric Aliases**: When extracting the `metrics` object for the Main IPC Summary, use these aliases to identify the correct values in the spreadsheet:
       - gross_amount_claimed: "total value of work done", "total work done", "value of work done", "total work done (instructed)", "work done", "gross claimed"
       - gross_amount_certified: "gross certified", "gross valuation"
       - materials_on_site: "add materials on site", "material on site", "materials on site"
       - price_variation: "variation of price", "variation of price adjustment", "vop"
       - vat_amount: "add 16% vat", "add v.a.t", "vat @ 16%", "value added tax", "vat"
       - retention_deducted: "less retention", "retention of contract sum", "10% retention", "5% retention", "retention"
       - advance_recovered: "recovery of advance", "advance payment recovery", "recovery of advance payment", "advance recovery"
       - withholding_vat: "withholding vat", "withold vat", "wht vat", "2% withholding vat", "less 2% withholding vat"
       - withholding_tax: "withholding tax", "withold tax", "wht tax", "3% withholding tax", "less 3% withholding tax"
       - net_amount_due: "now due to contractor", "payment now due to the contractor", "payment now due", "net payment", "net amount due"

    3. **Extraction Rules**:
       - Extract all numerical values as standard floats (e.g. 1500000.00). Remove currency symbols and commas.
       - If a value is missing or "Nil", use 0.0.
       - If a sheet is absolutely not present in the provided text, set its `found` flag to false.
       - If you find the Main IPC Summary, set `is_ipc_document` to true.
    
    Return your analysis STRICTLY as VALID JSON matching this schema:
    {json.dumps(schema_json, indent=2)}
    
    Workbook Data (first 35 rows of each sheet):
    ---
    {formatted_data}
    ---
    """
    
    response = await generate_text(prompt, force_pro=True)
    
    if "error" in response:
        logger.error(f"AI Extraction failed: {response['error']}")
        # Return fallback empty structure
        return {
            "is_ipc_document": False,
            "ipc_summary": {"found": False, "metrics": {}, "raw_breakdown": []},
            "advance_recovery": {"found": False, "metrics": {}, "raw_breakdown": []},
            "boq_grand_summary": {"found": False, "data": []}
        }
        
    raw_text = response.get("text", "")
    try:
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```json"): cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"): cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"): cleaned_text = cleaned_text[:-3]
        
        validated_data = FullIpcExtraction.model_validate_json(cleaned_text.strip())
        return validated_data.model_dump()
        
    except Exception as e:
        logger.error(f"Failed to parse AI IPC extraction response: {e}")
        return {
            "is_ipc_document": False,
            "ipc_summary": {"found": False, "metrics": {}, "raw_breakdown": []},
            "advance_recovery": {"found": False, "metrics": {}, "raw_breakdown": []},
            "boq_grand_summary": {"found": False, "data": []}
        }
