from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..models.document import Document
from ..models.action import Action
from ..models.user import User
from ..routes.users import get_current_user
from ..services.ai_client import generate_text
from pydantic import BaseModel
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Assist"])

# Simple in-memory cache to prevent overconsumption of AI tokens
# In production, this would be replaced with Redis.
CONTEXT_CACHE = {}
ASSIGNEE_CACHE = {}

class ContextSuggestionRequest(BaseModel):
    document_id: int

class ContextSuggestionResponse(BaseModel):
    description: str
    reason: str

class AssigneeSuggestionRequest(BaseModel):
    action_description: str
    document_id: int

class AssigneeSuggestionResponse(BaseModel):
    user_id: int
    reasoning: str

@router.post("/projects/{project_id}/ai/suggest-context", response_model=ContextSuggestionResponse)
async def suggest_context(
    project_id: int,
    request: ContextSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uses Gemini to suggest a context description and link reason for a document.
    """
    doc = db.query(Document).filter(Document.id == request.document_id, Document.project_id == project_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    cache_key = f"{project_id}_{request.document_id}"
    if cache_key in CONTEXT_CACHE:
        return CONTEXT_CACHE[cache_key]

    prompt = f"""
    You are an AI assistant for a construction project management system.
    A user just linked a new document. We need to auto-suggest a short "context_description" and a "link_reason".
    
    Document Metadata:
    - Name: {doc.name}
    - Type: {doc.file_type}
    - Department: {doc.department}
    - Origin: {doc.origin}
    
    Based on this information, suggest a likely context. 
    Return ONLY a valid JSON object with the keys "description" and "reason". No markdown formatting or backticks.
    
    Example: {{"description": "Latest version of the BoQ", "reason": "Cost review"}}
    """

    res = await generate_text(prompt)
    if "error" in res:
        raise HTTPException(status_code=500, detail=res["error"])

    try:
        raw_text = res["text"].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        data = json.loads(raw_text)
        resp = ContextSuggestionResponse(
            description=data.get("description", ""),
            reason=data.get("reason", "")
        )
        CONTEXT_CACHE[cache_key] = resp
        return resp
    except Exception as e:
        logger.error(f"Failed to parse Gemini response: {e}. Raw: {res['text']}")
        return ContextSuggestionResponse(
            description=f"Auto-generated based on {doc.name}",
            reason="Automated linking"
        )

@router.post("/projects/{project_id}/ai/suggest-assignee", response_model=AssigneeSuggestionResponse)
async def suggest_assignee(
    project_id: int,
    request: AssigneeSuggestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uses Gemini to suggest the best assignee for an action.
    """
    # Fetch project users
    users = db.query(User).all()
    user_list = "\\n".join([f"ID: {u.id}, Role: {u.role}" for u in users])

    doc = db.query(Document).filter(Document.id == request.document_id).first()
    department = doc.department if doc else "General"

    cache_key = f"{project_id}_{request.document_id}_{request.action_description}"
    if cache_key in ASSIGNEE_CACHE:
        return ASSIGNEE_CACHE[cache_key]

    prompt = f"""
    You are an AI assistant for a construction project. 
    An action is being created: "{request.action_description}"
    The action is related to the {department} department.
    
    Here are the available users:
    {user_list}
    
    Which user ID is the most logical assignee for this task?
    Return ONLY a JSON object with keys "user_id" (integer) and "reasoning" (short string). No markdown formatting.
    """

    res = await generate_text(prompt)
    if "error" in res:
        raise HTTPException(status_code=500, detail=res["error"])

    try:
        raw_text = res["text"].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        data = json.loads(raw_text)
        
        # Validate user_id exists
        uid = int(data.get("user_id", 1))
        if not any(u.id == uid for u in users):
            uid = users[0].id if users else 1
            
        resp = AssigneeSuggestionResponse(
            user_id=uid,
            reasoning=data.get("reasoning", "Based on department match")
        )
        ASSIGNEE_CACHE[cache_key] = resp
        return resp
    except Exception as e:
        logger.error(f"Failed to parse Gemini response: {e}. Raw: {res['text']}")
        return AssigneeSuggestionResponse(
            user_id=users[0].id if users else 1,
            reasoning="Fallback assignment due to parse error"
        )
