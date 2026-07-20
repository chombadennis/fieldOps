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
            full_name="Dennis Chomba",
            role=role,
            department="Engineering",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
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
