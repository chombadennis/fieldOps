from fastapi import APIRouter

router = APIRouter()

@router.get("/projects")
def get_projects():
    # Logic to get all projects
    return []
