from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional
from .ai_client import generate_text
import json
import logging
import re
import os
import tempfile
import hashlib
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

# --- 1. The Strict Pydantic Blueprint ---
class ExtractedBoqItem(BaseModel):
    bill_item_number: Optional[str] = Field(description="The exact item number from the BOQ, e.g. '3.1.4' or 'A'. Null if not found.")
    description: str = Field(description="The detailed description combined into a single string.")
    row_category: str = Field(default='LINE_ITEM', description="HEADER, LINE_ITEM, or SUMMARY.")
    hierarchy_level: int = Field(default=-1, description="0 for Bill No, 1 for subsections, etc.")
    unit: Optional[str] = Field(description="The unit, e.g. 'm3', 'kg'. Null if not found.")
    quantity: float = Field(default=0.0)
    rate: float = Field(default=0.0)
    amount: float = Field(default=0.0)

class BoqExtractionList(BaseModel):
    project_metadata: Optional[dict] = Field(None, description="Metadata like project_name, client, date.")
    boq_items: List[ExtractedBoqItem]

# --- 2. The Extraction Logic ---
async def _extract_single_chunk(text: str, file_path: str = None, mime_type: str = None) -> dict:
    schema_json = BoqExtractionList.model_json_schema()
    
    prompt = f"""
    You are an expert Construction Quantity Surveyor and Data Extraction AI. 
    Analyze this Bill of Quantities (BOQ) data with extreme precision.
    
    CRITICAL EXTRACTION RULES:
    1. **Description Merging**: BOQ data often spans multiple lines. If a row continues a description from the previous line (even if on a new page), COMBINE them into one single `description` string.
    2. **Structural Headers**: 
       - Identify major sections (e.g., 'ELEMENT NO. 1', 'SUBSTRUCTURES', 'CONCRETE WORKS').
       - Set `row_category` = 'HEADER'.
       - Set `hierarchy_level`: 0 for major Bills, 1 for Elements, 2 for Sub-headings.
       - Set quantity, rate, and amount to 0.0 for headers.
    3. **Line Items**: 
       - Rows with units (m2, m3, kg, nr, lm) are 'LINE_ITEM'.
       - Ensure `bill_item_number` (e.g., 'A', '3.1') is captured.
    4. **Hierarchy Logic**: Every Line Item MUST belong to the nearest preceding Header.
    5. **Numerical Integrity**: Extract quantities, rates, and amounts as floats. Remove any 'Ksh', 'Shs', or commas.
    6. **Project Metadata**: If this is a Title/Cover page, extract: project_title, client, location, and date.
    
    Return DATA STRICTLY as VALID JSON matching this schema:
    {json.dumps(schema_json, indent=2)}
    
    Data:
    ---
    {text}
    ---
    """

    response = await generate_text(prompt, file_path, mime_type)
    if "error" in response:
        return {"error": response["error"]}

    raw_text = response.get("text", "")
    try:
        cleaned_text = raw_text.strip()
        if cleaned_text.startswith("```json"): cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"): cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"): cleaned_text = cleaned_text[:-3]
        
        validated_data = BoqExtractionList.model_validate_json(cleaned_text.strip())
        final_dict = validated_data.model_dump()
        return {"extracted_data": final_dict, "source": response.get("model")}
    except Exception as e:
        logger.error(f"Failed to parse AI response: {e}")
        return {"error": "JSON Parse Error", "raw": raw_text}

def stitch_boq_hierarchy(items: List[dict]) -> List[dict]:
    """Assigns parents using a hierarchy level stack."""
    stitched_items = []
    header_stack = {} # level -> index
    
    for i, item in enumerate(items):
        item_copy = item.copy()
        item_copy['temp_id'] = i
        level = item.get('hierarchy_level', -1)
        
        if item.get('row_category') == 'HEADER' and level >= 0:
            potential_parents = [l for l in header_stack.keys() if l < level]
            item_copy['parent_index'] = header_stack[max(potential_parents)] if potential_parents else None
            header_stack[level] = i
            # Clear deeper levels
            for k in list(header_stack.keys()):
                if k > level: del header_stack[k]
        else:
            item_copy['parent_index'] = header_stack[max(header_stack.keys())] if header_stack else None
                
        stitched_items.append(item_copy)
    return stitched_items

async def get_ai_extraction(text: str, file_path: str = None, mime_type: str = None, redis_client=None) -> dict:
    """Wrapper that chunks PDF and uses page-level caching to 'Resume' aborted extractions."""
    if file_path and mime_type == "application/pdf":
        try:
            reader = PdfReader(file_path)
            total_pages = len(reader.pages)
            all_boq_items = []
            project_metadata = {}
            final_source = "Google AI"
            
            for i in range(total_pages):
                # 1. Create the page chunk as a byte-stream
                writer = PdfWriter()
                writer.add_page(reader.pages[i])
                
                # We write to a temporary buffer to get the RAW BYTES for hashing
                import io
                buf = io.BytesIO()
                writer.write(buf)
                page_data = buf.getvalue()
                
                # 2. Generate a Unique Fingerprint for this specific page's visual content
                # We use a 'v3' salt to ensure we stay clean and fresh!
                page_hash = hashlib.sha256(page_data).hexdigest()
                cache_key = f"page_parse_cache_v3:{page_hash}"
                
                # 3. Check for "Resume" in Redis
                if redis_client:
                    try:
                        cached = await redis_client.get(cache_key)
                        if cached:
                            logger.info(f"🟢 RESUME: Using cached result for PDF Page {i+1} (Unique Hash: {page_hash[:8]})")
                            chunk_result = json.loads(cached)
                            ext_data = chunk_result.get("extracted_data", {})
                            if ext_data.get("project_metadata"): project_metadata.update(ext_data.get("project_metadata"))
                            all_boq_items.extend(ext_data.get("boq_items", []))
                            continue
                    except Exception as e:
                        logger.error(f"Redis Cache skip failure: {e}")

                # 4. Not in Cache? Proceed to Vertex AI
                logger.info(f"-> Processing PDF chunk (Page {i + 1} of {total_pages})")
                fd, temp_chunk_path = tempfile.mkstemp(suffix=f"_chunk_{i+1}.pdf")
                try:
                    with os.fdopen(fd, 'wb') as tmp: 
                         tmp.write(page_data)
                    
                    instruction_text = f"Page {i + 1} of {total_pages}. Analyze this page."
                    chunk_result = await _extract_single_chunk(instruction_text, temp_chunk_path, mime_type)
                    
                    if "error" in chunk_result:
                        logger.error(f"Failed Page {i + 1}. Error: {chunk_result.get('error')}")
                        continue
                        
                    ext_data = chunk_result.get("extracted_data", {})
                    if ext_data.get("project_metadata"): project_metadata.update(ext_data.get("project_metadata"))
                    
                    items_found = ext_data.get("boq_items", [])
                    all_boq_items.extend(items_found)
                    final_source = chunk_result.get("source", final_source)
                    
                    # 5. SAVE to Redis Cache if we found actual data
                    if redis_client and items_found:
                        try:
                            await redis_client.set(cache_key, json.dumps(chunk_result), ex=86400)
                            logger.info(f"🎯 CACHED: Saved {len(items_found)} items for Page {i+1}")
                        except: pass
                finally:
                    if os.path.exists(temp_chunk_path): os.remove(temp_chunk_path)
            
            logger.info("Stitching hierarchical relationships...")
            hierarchical_items = stitch_boq_hierarchy(all_boq_items)
            return {
                "project_metadata": project_metadata,
                "extracted_data": {"boq_items": hierarchical_items},
                "source": final_source
            }
        except Exception as e:
            logger.error(f"Chunking failure: {e}")
            return {"error": str(e)}

    # Fallback for Excel/Text
    single_res = await _extract_single_chunk(text, file_path, mime_type)
    if "extracted_data" in single_res:
        single_res["extracted_data"]["boq_items"] = stitch_boq_hierarchy(single_res["extracted_data"]["boq_items"])
    return single_res
