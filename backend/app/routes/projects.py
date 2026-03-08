from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import schemas
from ..db import database, crud

router = APIRouter()

# Dependency to get the database session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/projects", response_model=schemas.project.Project)
def create_project(project: schemas.project.ProjectCreate, db: Session = Depends(get_db)):
    """
    Create a new project.
    """
    return crud.create_project(db=db, project=project)

@router.get("/projects", response_model=List[schemas.project.Project])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all projects.
    """
    projects = crud.get_projects(db, skip=skip, limit=limit)
    return projects

@router.get("/projects/{project_id}", response_model=schemas.project.Project)
def read_project(project_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a single project by its ID.
    """
    db_project = crud.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@router.put("/projects/{project_id}", response_model=schemas.project.Project)
def update_project(project_id: int, project: schemas.project.ProjectUpdate, db: Session = Depends(get_db)):
    """
    Update an existing project.
    """
    db_project = crud.update_project(db, project_id=project_id, project=project)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@router.delete("/projects/{project_id}", response_model=schemas.project.Project)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """
    Delete a project.
    """
    db_project = crud.delete_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project
