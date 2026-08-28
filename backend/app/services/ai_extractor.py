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
    is_boq_document: bool = Field(default=True, description="Set to false ONLY IF you are absolutely certain this page is not a BoQ (e.g. an Invoice or HR Timesheet).")
    identified_document_type: Optional[str] = Field(None, description="If is_boq_document is false, explain what the document actually is.")
    project_metadata: Optional[dict] = Field(None, description="Metadata like project_title, client, location, date.")
    boq_items: List[ExtractedBoqItem]
    confidence_score: float = Field(default=1.0, description="Confidence score from 0.0 to 1.0 based on extraction clarity.")

# --- 2. The Extraction Logic ---
async def _extract_single_chunk(text: str, file_path: str = None, mime_type: str = None, prev_state: str = None, force_pro: bool = False) -> dict:
    schema_json = BoqExtractionList.model_json_schema()
    
    state_injection = f"\n--- PREVIOUS CONTEXT ---\n{prev_state}\n" if prev_state else ""
    
    prompt = f"""
    You are an expert Construction Quantity Surveyor and Data Extraction AI. 
    Analyze this Bill of Quantities (BOQ) data with extreme precision.
    {state_injection}
    
    CRITICAL EXTRACTION RULES:
    1. **BOUNCER CHECK (CRITICAL)**: Analyze the page structure. Does this look like a Bill of Quantities (or part of one, like a title page or BOQ summary)?
       - If you are ABSOLUTELY CERTAIN this is an entirely unrelated document (e.g., an Invoice, HR Timesheet, or random article), set `is_boq_document` = false and describe what it is in `identified_document_type`. Then return empty `boq_items` and stop.
       - Otherwise, assume `is_boq_document` = true and proceed.
    2. **Description Merging**: BOQ data often spans multiple lines. 
       - If a row continues a description from the previous line (even if on a new page), COMBINE them into one single `description` string.
       - If a description starts with an introductory text block ending in a preposition (e.g., 'laid on top of', 'suitable for', 'consisting of') and is completed by a line item below it, merge the introductory text block directly into the line item's description instead of creating a separate empty HEADER.
    3. **Structural Headers**: 
       - Identify major sections (e.g., 'ELEMENT NO. 1', 'SUBSTRUCTURES', 'CONCRETE WORKS').
       - Set `row_category` = 'HEADER'.
       - Set `hierarchy_level`: 0 for major Bills, 1 for Elements, 2 for Sub-headings.
       - Set quantity, rate, and amount to 0.0 for headers.
    4. **Line Items**: 
       - Rows with units (m2, m3, kg, nr, lm) are 'LINE_ITEM'.
       - Ensure `bill_item_number` (e.g., 'A', '3.1') is captured.
    5. **Hierarchy Logic**: Every Line Item MUST belong to the nearest preceding Header.
    6. **Numerical Integrity**: Extract quantities, rates, and amounts as floats. Remove any 'Ksh', 'Shs', or commas.
    7. **Project Metadata**: If this is a Title/Cover page, extract: project_title, client, location, and date.
    
    **ATTENTION HINTS** (Fix #3):
    - Focus strictly on **Structural Headers** (e.g., 'BILL NO. 1', 'ELEMENTS', 'SUBSECTIONS') and **Line Item rows** (rows containing units like m3, m2, kg, nr, lm or numeric quantities).
    - Ignore non-data "Page Noise" like page numbers, document dates, copyright notices, and decorative title text.
    
    Return DATA STRICTLY as VALID JSON matching this schema:
    {json.dumps(schema_json, indent=2)}
    
    Data:
    ---
    {text}
    ---
    """

    response = await generate_text(prompt, file_path, mime_type, force_pro=force_pro)
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
        
        # --- Fix #5: Confidence-Based Fallback ---
        conf = final_dict.get("confidence_score", 1.0)
        if conf < 0.85 and not response.get("is_fallback"):
            logger.warning(f"⚠️ Low Confidence ({conf}). Triggering deep-scan with Gemini Pro...")
            return await _extract_single_chunk(text, file_path, mime_type, prev_state, force_pro=True)
            
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
                    
                    # 4.1 Construct Context State (Fix #1: State Injection)
                    prev_state_str = None
                    if all_boq_items:
                        # Find the last header and last item encountered so far
                        last_header = next((item['description'] for item in reversed(all_boq_items) if item.get('row_category') == 'HEADER'), "Unknown")
                        last_item_num = next((item['bill_item_number'] for item in reversed(all_boq_items) if item.get('bill_item_number')), "None")
                        prev_state_str = f"Latest Header: {last_header}, Last Item No: {last_item_num}"

                    instruction_text = f"Page {i + 1} of {total_pages}. Analyze this page."
                    chunk_result = await _extract_single_chunk(instruction_text, temp_chunk_path, mime_type, prev_state=prev_state_str)
                    
                    if "error" in chunk_result:
                        logger.error(f"Failed Page {i + 1}. Error: {chunk_result.get('error')}")
                        continue
                        
                    ext_data = chunk_result.get("extracted_data", {})
                    
                    # --- BOUNCER CHECK LOGIC ---
                    is_boq = ext_data.get("is_boq_document", True)
                    if not is_boq:
                        logger.warning(f"Page {i+1} rejected by AI as not a BOQ (Identified as: {ext_data.get('identified_document_type')})")
                        
                        # If we haven't found any valid BoQ items yet, and we've checked up to 5 pages, abort the entire document.
                        if not all_boq_items and (i + 1) >= min(5, total_pages):
                            return {
                                "error": "not_a_boq",
                                "identified_document_type": ext_data.get("identified_document_type") or "Unknown Document"
                            }
                        continue # Skip adding items for this rejected page
                    
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
                    
                    # 5.1 BREATHING ROOM: Short pause to avoid 429 Resource Exhausted on multi-page PDF
                    import asyncio
                    await asyncio.sleep(3)
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
