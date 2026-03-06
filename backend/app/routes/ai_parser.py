from fastapi import APIRouter

router = APIRouter()

@router.post("/ai/parse-activity")
def parse_activity_with_ai():
    # Logic to parse activity with AI
    return {"message": "Activity parsed"}
