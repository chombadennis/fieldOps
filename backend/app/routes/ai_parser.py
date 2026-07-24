from fastapi import APIRouter, File, UploadFile, HTTPException, Request, Form, Depends
from typing import Optional
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models.project import Project
from ..models.boq_item import BoqItem
from ..services import excel_parser, ai_extractor
from ..core.config import settings
from ..limiter import limiter # Import from the new central file
import hashlib
import json
import logging
import tempfile
import os

# --- Configure Logging ---
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/ai/parse-boq")
@limiter.limit("5/minute") # This limit is now imported from limiter.py
async def parse_boq_with_ai(
    request: Request, 
    project_id: int = Form(...), 
    contract_id: Optional[int] = Form(None),
    boq_name: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    """
    Receives a Bill of Quantities (BOQ) file, parses it, extracts structured data using AI,
    permanently saves it into the PostgreSQL boq_items table under the provided project_id and contract_id,
    and returns the saved result.
    """
    from ..db.database import SessionLocal # Import for manual session management
    from ..models.boq_document import BoqDocument
    from ..models.contract import Contract

    # 1. Validate File Type NOW ALLOWS PDFs!
    if not file.filename.endswith(('.xls', '.xlsx', '.pdf')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only Excel (.xls, .xlsx) or PDF (.pdf) files are accepted.")

    try:
        contents = await file.read()
        file_hash = hashlib.sha256(contents).hexdigest()

        # 0. Validate Project and Contract Exist & Check Limits/Duplicates BEFORE we do expensive AI work
        with SessionLocal() as db:
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found in the database. Cannot attach BOQ.")
            
            # Validate or Default Contract ID
            if contract_id is not None:
                contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
                if not contract:
                    raise HTTPException(status_code=400, detail=f"Contract with ID {contract_id} does not belong to Project {project_id}.")
            else:
                contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
                if not contract:
                    contract = Contract(project_id=project_id, name="General Contract", contract_type="GENERAL")
                    db.add(contract)
                    db.commit()
                    db.refresh(contract)
                contract_id = contract.id

            # Count existing BOQs under this contract
            boq_count = db.query(BoqDocument).filter(BoqDocument.contract_id == contract_id).count()
            if boq_count >= 5:
                raise HTTPException(status_code=400, detail="Limit reached: A contract can have up to 5 BOQ documents.")
            
            # Check for duplicate file hash
            duplicate = db.query(BoqDocument).filter(
                BoqDocument.contract_id == contract_id,
                BoqDocument.file_hash == file_hash
            ).first()
            if duplicate:
                raise HTTPException(status_code=400, detail="This BOQ file has already been uploaded for this contract.")
        
        # 2. Caching Logic (Async - Redis should be started via Docker!)
        redis_client = request.app.state.redis
        file_hash = hashlib.sha256(contents).hexdigest()
        cache_key = f"boq_parse_cache:{file_hash}"
        
        if redis_client:
            try:
                cached_result = await redis_client.get(cache_key)
                if cached_result:
                    logger.info(f"Returning cached result for file hash: {file_hash}")
                    return json.loads(cached_result)
            except Exception as e:
                logger.error(f"Redis GET command failed: {e}")

        # 3. File Processing & AI Extraction (Async)
        # --- DATABASE CONNECTION IS CLOSED DURING THIS PART! ---
        ai_result = None
        
        # -- SCENARIO A: EXCEL PARSING --
        if file.filename.endswith(('.xls', '.xlsx')):
            try:
                parsed_sheets = excel_parser.parse_excel(contents)
                if not parsed_sheets:
                    raise ValueError("Could not parse the Excel file. It might be empty or corrupted.")
                
                first_sheet_name = list(parsed_sheets.keys())[0]
                df = parsed_sheets[first_sheet_name]
                boq_text = df.to_string()
                ai_result = await ai_extractor.get_ai_extraction(text=boq_text, redis_client=redis_client)
            except Exception as e:
                logger.error(f"Failed to parse Excel file: {e}")
                raise HTTPException(status_code=400, detail=str(e))
                
        # -- SCENARIO B: PDF VISION PARSING --
        elif file.filename.endswith('.pdf'):
            logger.info("PDF Detected. Initiating secure Gemini File Upload pipeline...")
            fd, temp_pdf_path = tempfile.mkstemp(suffix=".pdf")
            try:
                with os.fdopen(fd, 'wb') as f:
                    f.write(contents)
                instruction_text = "See the attached visual PDF document."
                ai_result = await ai_extractor.get_ai_extraction(text=instruction_text, file_path=temp_pdf_path, mime_type="application/pdf", redis_client=redis_client)
            finally:
                if os.path.exists(temp_pdf_path):
                    os.remove(temp_pdf_path)

        if "error" in ai_result:
            logger.error(f'AI extraction failed: {ai_result.get("error")}')
            raise HTTPException(status_code=502, detail=f'AI Service Error: {ai_result.get("error")}')

        # --- 4. THE RESCUE: SAVE DATA TO POSTGRESQL ---
        # We open a NEW database connection ONLY NOW, after the 27-minute wait is OVER.
        logger.info(f"AI Extraction complete. Opening fresh DB session to save results for Project {project_id}...")
        
        with SessionLocal() as db:
            try:
                # Re-fetch project in this new session
                project = db.query(Project).filter(Project.id == project_id).first()
                
                metadata = ai_result.get("project_metadata", {})
                if metadata:
                    logger.info(f"Updating metadata for Project {project_id}: {metadata}")
                    if metadata.get("project_title"): project.name = metadata.get("project_title")
                    if metadata.get("location"): project.location = metadata.get("location")
                    if metadata.get("client"): project.client_name = metadata.get("client")

                
                # Create the BoqDocument container
                doc_name = boq_name or file.filename or "Main BOQ"
                boq_doc = BoqDocument(
                    project_id=project_id,
                    contract_id=contract_id,
                    name=doc_name,
                    file_hash=file_hash,
                    origin="file_upload"
                )
                db.add(boq_doc)
                db.flush()  # obtain boq_doc.id
                
                boq_list = ai_result["extracted_data"]["boq_items"]
                id_map = {}
                
                for item in boq_list:
                    db_item = BoqItem(
                        boq_id=boq_doc.id,
                        bill_item_number=item.get("bill_item_number"),
                        description=item.get("description", ""),
                        row_category=item.get("row_category", "LINE_ITEM"),
                        hierarchy_level=item.get("hierarchy_level", -1),
                        unit=item.get("unit"),
                        quantity=item.get("quantity", 0.0),
                        rate=item.get("rate", 0.0),
                        amount=item.get("amount", 0.0)
                    )
                    
                    parent_idx = item.get("parent_index")
                    if parent_idx is not None and parent_idx in id_map:
                        db_item.parent_id = id_map[parent_idx]
                    
                    db.add(db_item)
                    db.flush()
                    id_map[item.get("temp_id")] = db_item.id
                
                db.commit()
                logger.info(f"Successfully committed {len(boq_list)} items to PostgreSQL for Project {project_id}.")
                
            except Exception as save_err:
                db.rollback()
                logger.error(f"Rolling back database. Failed to save BOQ items: {save_err}")
                # We log the raw JSON here as a backup so the user doesn't lose the AI work
                logger.info("CRITICAL BACKUP: Printing raw AI JSON in case of database failure:")
                logger.info(json.dumps(ai_result))
                raise HTTPException(status_code=500, detail="Passed AI Extraction, but failed to save to Database. Check logs for raw JSON backup.")

        # 5. Store in Cache (Async)
        if redis_client:
            try:
                logger.info(f"Storing result in cache for file hash: {file_hash}")
                await redis_client.set(cache_key, json.dumps(ai_result), ex=3600)
            except Exception as e:
                logger.error(f"Redis SET command failed: {e}")

        return ai_result

    except HTTPException as e:
        # Re-raise known HTTP exceptions (like 404 or 400)
        raise e
    except Exception as e:
        error_msg = str(e)
        
        # Log the full stack trace for the developer
        logger.exception("Final Parser Exception:")

        # --- Custom AI Error Mapping ---
        if "503" in error_msg or "Service Unavailable" in error_msg:
             raise HTTPException(status_code=503, detail="Gemini AI is currently overloaded. We tried multiple times, but Google is busy. Please wait a minute and try again.")
        
        if "429" in error_msg or "Rate Limit" in error_msg:
             raise HTTPException(status_code=429, detail="Your AI Rate Limit has been reached. If you are on the Free Tier, wait 60 seconds. Otherwise, check your Gemini billing.")
        
        if "pypdf" in error_msg.lower():
             raise HTTPException(status_code=400, detail="The PDF file seems to be corrupted or password protected. AI could not read it.")

        # Generic fallback
        raise HTTPException(status_code=500, detail=f"Internal BOQ Parser Error: {error_msg}")
