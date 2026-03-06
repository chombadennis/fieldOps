from fastapi import APIRouter

router = APIRouter()

@router.post("/activities")
def log_activity():
    # Logic to log an activity
    return {"message": "Activity logged"}
