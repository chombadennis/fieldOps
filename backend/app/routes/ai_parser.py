from fastapi import APIRouter, File, UploadFile, HTTPException, Request
from ..services import excel_parser, ai_extractor
from ..core.config import settings
from ..limiter import limiter # Import from the new central file
import hashlib
import json
import logging

# --- Configure Logging ---
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/ai/parse-boq")
@limiter.limit("5/minute") # This limit is now imported from limiter.py
async def parse_boq_with_ai(request: Request, file: UploadFile = File(...)):
    """
    Receives a Bill of Quantities (BOQ) file, parses it, extracts structured data using AI,
    and includes rate limiting and caching. This endpoint is now fully asynchronous.
    """
    # 1. Validate File Type
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only Excel files (.xls, .xlsx) are accepted.")

    try:
        contents = await file.read()
        
        # 2. Caching Logic (Async)
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
                # If Redis fails, we can proceed without caching

        # 3. File Parsing
        try:
            parsed_sheets = excel_parser.parse_excel(contents)
            if not parsed_sheets:
                raise ValueError("Could not parse the Excel file. It might be empty or corrupted.")
            
            first_sheet_name = list(parsed_sheets.keys())[0]
            df = parsed_sheets[first_sheet_name]
            
            if df.empty:
                raise ValueError("The first sheet of the Excel file is empty.")

            boq_text = df.to_string()
        except Exception as e:
            logger.error(f"Failed to parse Excel file: {e}")
            raise HTTPException(status_code=400, detail=str(e))

        # 4. AI Data Extraction (Async)
        ai_result = await ai_extractor.get_ai_extraction(boq_text)

        if "error" in ai_result:
            # The error could be from the AI service or from our parsing of its response
            logger.error(f'AI extraction failed: {ai_result.get("error")}')
            # We return a 502 Bad Gateway if the upstream AI service is the problem
            raise HTTPException(status_code=502, detail=f'AI Service Error: {ai_result.get("error")}')

        # 5. Store in Cache (Async)
        if redis_client:
            try:
                logger.info(f"Storing result in cache for file hash: {file_hash}")
                # Cache result for 1 hour (3600 seconds)
                await redis_client.set(cache_key, json.dumps(ai_result), ex=3600)
            except Exception as e:
                logger.error(f"Redis SET command failed: {e}")
                # Failure to cache is not a critical error, so we just log it

        return ai_result

    except HTTPException as e:
        # Re-raise known HTTP exceptions to be handled by FastAPI
        raise e
    except Exception as e:
        logger.exception("An unexpected error occurred in the BOQ parsing endpoint.")
        raise HTTPException(status_code=500, detail="An unexpected internal server error occurred.")
