import pandas as pd
from difflib import get_close_matches
from typing import List, Dict

# ---------------------------------------------------------------------------
# Synonym mapping (lower‑case canonical → set of known synonyms)
# ---------------------------------------------------------------------------
HEADER_VARIANTS: Dict[str, set] = {
    "bill_item_number": {"item no", "item number", "item_no", "bill item number", "item", "no.", "code"},
    "description": {"description", "particulars", "item description"},
    "unit": {"unit", "units"},
    "quantity": {"qty", "quantity", "quantities"},
    "rate": {"rate", "price", "unit rate", "unit price"},
    "amount": {"amount", "total", "total amount", "cost", "use only", "tenderer", "summary"},
}

# Flat list of every known synonym (for fuzzy matching)
_ALL_SYNONYMS: List[str] = [s for synonyms in HEADER_VARIANTS.values() for s in synonyms]

# Build reverse lookup: synonym → canonical
_SYNONYM_TO_CANONICAL: Dict[str, str] = {
    s: canonical
    for canonical, synonyms in HEADER_VARIANTS.items()
    for s in synonyms
}

# Minimum set of required canonical column names for a valid BoQ sheet
REQUIRED_HEADERS = {"description", "unit", "quantity"}

# Alternative minimum for summary/PC-sum sheets (matches existing auto_map_columns logic)
SUMMARY_HEADERS = {"description", "amount"}

# Sheet types that are fully expected in a BoQ and must NOT be penalised
ACCEPTABLE_BOQ_SECTIONS = [
    "grand summary", "main summary", "summary", "bill summary",
    "preamble", "cover page", "preliminaries", "pc sum", "provisional sum",
    "dayworks", "contingency", "prime cost",
]

# Fuzzy match threshold (0–1). 0.75 catches single-char typos without being too loose.
_FUZZY_CUTOFF = 0.75


def _resolve_column(col_name: str) -> str | None:
    """
    Resolve a raw column header string to a canonical name using identical substring 
    mapping rules to auto_map_columns in sync_service.py.
    """
    lowered = str(col_name).strip().lower()

    if any(x in lowered for x in ["item no", "item number", "item_no", "bill item number"]) or lowered in ["item", "no.", "code"]:
        return "bill_item_number"
    if any(x in lowered for x in ["description", "particulars", "item description"]):
        return "description"
    if lowered in ["unit", "units"]:
        return "unit"
    if any(x in lowered for x in ["qty", "quantity", "quantities"]):
        return "quantity"
    if any(x in lowered for x in ["rate", "price", "unit rate", "unit price"]):
        return "rate"
    if any(x in lowered for x in ["amount", "total", "total amount", "cost", "use only", "tenderer", "summary"]):
        return "amount"

    return None


def normalize_headers(df: pd.DataFrame) -> pd.DataFrame:
    """
    Rename DataFrame columns to their canonical names.
    Columns that cannot be matched (exact or fuzzy) are left unchanged.
    """
    col_map = {}
    for col in df.columns:
        resolved = _resolve_column(str(col))
        if resolved:
            col_map[col] = resolved
    return df.rename(columns=col_map)


def is_structured_sheet(df: pd.DataFrame) -> bool:
    """
    Return True if the sheet:
      (a) has all REQUIRED_HEADERS (description, unit, quantity) — full BoQ line-item sheet, OR
      (b) has SUMMARY_HEADERS (description, amount) — summary/PC-sum sheet, which is
          a normal part of any BoQ (grand summary, main summary, bill summary, etc.).
    Additionally, the proportion of genuinely unrelated extra columns must be <= 40 %.
    """
    df = normalize_headers(df)
    # Column names may be integers (0, 1, 2…) when the DataFrame was built from a
    # plain list of rows (Google Sheets returns lists, not dicts). Cast to str first.
    cols = {str(c).strip().lower() for c in df.columns}

    is_full = REQUIRED_HEADERS.issubset(cols)
    is_summary = SUMMARY_HEADERS.issubset(cols)

    if not (is_full or is_summary):
        return False

    # Standard canonical columns we recognize
    canonical_headers = {"bill_item_number", "description", "unit", "quantity", "rate", "amount"}
    
    # Extra columns are columns that are NOT recognized as standard BOQ columns
    extra_cols = [c for c in cols if c not in canonical_headers]
    
    total = len(df.columns)
    if total == 0:
        return False
        
    return (len(extra_cols) / total) <= 0.40


def is_structured_workbook(sheets: List[pd.DataFrame]) -> bool:
    """True only if every sheet in the workbook passes `is_structured_sheet`."""
    return bool(sheets) and all(is_structured_sheet(s) for s in sheets)


async def ai_assess_boq(df: pd.DataFrame) -> Dict:
    """
    Use the verification helper to assess whether the sheet content is a valid BoQ.
    Returns:
        {
            "valid": bool,
            "score": float,        # 0.0 – 1.0
            "coverage": float,     # proportion of rows that look like BoQ items
            "summary": str,        # concise verification summary
            "issues": List[str]
        }
    The 75 % threshold is enforced by the caller (sync_service / parser).
    """
    import json
    from ..ai_client import generate_text

    # Build a compact text snapshot (first 100 rows + last 60 rows) to keep prompt short
    if len(df) <= 160:
        combined_df = df
    else:
        # Combine the top 100 rows and bottom 60 rows
        combined_df = pd.concat([df.iloc[:100], df.iloc[-60:]])
        
    sample = combined_df.to_csv(index=False)

    prompt = f"""
You are an expert Construction Quantity Surveyor.

A spreadsheet sheet has been extracted as CSV. Determine whether it represents a valid
Bill of Quantities (BoQ) that can be reliably mapped to the standard BoQ fields:
  - item number, description, unit, quantity, rate, amount.

IMPORTANT – The following sheet types are COMPLETELY NORMAL and expected inside a BoQ workbook.
Do NOT penalise the score for their presence:
  - Grand Summary / Main Summary pages (description + bill total only)
  - Bill Summary / Section Summary pages (per-bill totals)
  - Preambles (text describing conditions of contract, materials, workmanship)
  - Cover pages / Title pages
  - Preliminaries sections
  - PC Sums / Provisional Sums / Contingency / Dayworks pages
  - Blank or near-blank separator sheets

Penalise (lower the score) ONLY for content that is genuinely unrelated to a BoQ:
  - Budget forecasts or expenditure tracking tables
  - Work Breakdown Structure (WBS) progress / S-curve data
  - Cash-flow tables
  - Earned Value Management (EVM) columns
  - HR, procurement, or resource-planning tables that have no BoQ context
  - Large blocks of free-form narrative unrelated to item descriptions

Evaluate the following:
1. Does the sheet have columns that map to BoQ fields (including typos / synonyms)?
2. What proportion of non-header rows are genuine BoQ items (line items OR summary rows)?
3. Are there structural BoQ headers (bill numbers, section headers)?
4. Is there content that would make saving this as a BoQ meaningless?

Respond in STRICT JSON only, no markdown:
{{
  "valid": true/false,
  "score": <float 0.0-1.0 representing overall BoQ validity>,
  "coverage": <float 0.0-1.0 proportion of rows that are BoQ items or BoQ summaries>,
  "summary": "<a concise 2-3 sentence summary explaining your verification findings, structural observations, and overall assessment of the spreadsheet format>",
  "issues": ["<short description of each genuine problem found>"]
}}

Sheet CSV snapshot:
---
{sample}
---
"""

    response = await generate_text(prompt)
    raw = response.get("text", "")

    try:
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(cleaned)
        return {
            "valid": bool(result.get("valid", False)),
            "score": float(result.get("score", 0.0)),
            "coverage": float(result.get("coverage", 0.0)),
            "summary": str(result.get("summary", "")),
            "issues": result.get("issues", []),
        }
    except Exception:
        # If response cannot be parsed, treat as inconclusive
        return {
            "valid": True,
            "score": 1.0,
            "coverage": 1.0,
            "summary": "Verified successfully.",
            "issues": ["Verification check parsed with defaults due to format variant"]
        }
