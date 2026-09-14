from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import database
from ..models.user import User
from ..schemas import platform as platform_schemas

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/users/me", response_model=platform_schemas.User)
def get_current_user(role: str = "admin", db: Session = Depends(get_db)):
    """
    Mock endpoint for active user profile & role-based authentication.
    Defaults to Admin role, configurable via query parameter.
    """
    user = db.query(User).filter(User.email == "demo@fieldops.co").first()
    if not user:
        user = User(
            email="demo@fieldops.co",
            name="Dennis Chomba",
            role=role,
            firebase_uid="mock_firebase_uid_123"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if user.role != role:
            user.role = role
            db.commit()
            db.refresh(user)
            
    return user

@router.get("/projects/{project_id}/team", response_model=list[platform_schemas.User])
def get_project_team(project_id: int, db: Session = Depends(get_db)):
    """
    Returns all team members for the project. 
    Seeds 5 mock users if they do not exist.
    """
    users = db.query(User).all()
    
    # If only the main user exists, seed the mock team
    if len(users) <= 1:
        mock_team = [
            {"email": "sarah@fieldops.co", "name": "Sarah Miller", "role": "engineer"},
            {"email": "mike@fieldops.co", "name": "Mike Johnson", "role": "admin"},
            {"email": "jessica@fieldops.co", "name": "Jessica Williams", "role": "hr"},
            {"email": "david@fieldops.co", "name": "David Brown", "role": "legal"},
            {"email": "alex@fieldops.co", "name": "Alex Smith", "role": "field_officer"}
        ]
        
        for mock_user in mock_team:
            if not any(u.email == mock_user["email"] for u in users):
                new_user = User(
                    email=mock_user["email"],
                    name=mock_user["name"],
                    role=mock_user["role"],
                    firebase_uid=f"mock_firebase_{mock_user['name'].split()[0].lower()}"
                )
                db.add(new_user)
        
        db.commit()
        users = db.query(User).all()
        
    return users
