from sqlalchemy.orm import Session, selectinload
from .. import models, schemas

def get_project(db: Session, project_id: int):
    return db.query(models.project.Project).options(
        selectinload(models.project.Project.contracts),
        selectinload(models.project.Project.integrations),
        selectinload(models.project.Project.boq_documents)
    ).filter(models.project.Project.id == project_id).first()

def get_projects(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.project.Project).options(
        selectinload(models.project.Project.contracts),
        selectinload(models.project.Project.integrations),
        selectinload(models.project.Project.boq_documents)
    ).offset(skip).limit(limit).all()

def create_project(db: Session, project: schemas.project.ProjectCreate):
    db_project = models.project.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def update_project(db: Session, project_id: int, project: schemas.project.ProjectUpdate):
    db_project = get_project(db, project_id)
    if db_project:
        update_data = project.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_project, key, value)
        db.commit()
        db.refresh(db_project)
    return db_project

def delete_project(db: Session, project_id: int):
    db_project = get_project(db, project_id)
    if db_project:
        db.delete(db_project)
        db.commit()
    return db_project
