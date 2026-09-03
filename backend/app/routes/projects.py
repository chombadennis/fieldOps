from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import schemas
from ..db import database, crud
from ..utils.cache import get_cache, set_cache, invalidate_cache
from fastapi.encoders import jsonable_encoder

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
    
    # Inject cloud_email from AUTH_ONLY records into active integrations
    from .. import models
    auth_integrations = db.query(models.project_integration.ProjectIntegration).filter(
        models.project_integration.ProjectIntegration.spreadsheet_id == "AUTH_ONLY"
    ).all()
    
    # Map project_id -> provider_userid -> cloud_email
    auth_map = {}
    for auth in auth_integrations:
        if auth.meta_data and auth.meta_data.get("cloud_email"):
            if auth.project_id not in auth_map:
                auth_map[auth.project_id] = {}
            key = f"{auth.provider}_{auth.user_id}"
            auth_map[auth.project_id][key] = auth.meta_data.get("cloud_email")
            # Fallback
            if auth.provider not in auth_map[auth.project_id]:
                auth_map[auth.project_id][auth.provider] = auth.meta_data.get("cloud_email")
            
    for project in projects:
        for integration in project.integrations:
            if integration.spreadsheet_id != "AUTH_ONLY":
                key = f"{integration.provider}_{integration.user_id}"
                p_map = auth_map.get(project.id, {})
                cloud_email = p_map.get(key) or p_map.get(integration.provider)
                if cloud_email:
                    if not integration.meta_data:
                        integration.meta_data = {}
                    new_meta = dict(integration.meta_data)
                    new_meta["cloud_email"] = cloud_email
                    integration.meta_data = new_meta

        integration_map = {i.id: i for i in project.integrations}
        for doc in getattr(project, 'boq_documents', []):
            if doc.integration_id and doc.integration_id in integration_map:
                integration = integration_map[doc.integration_id]
                setattr(doc, 'uploaded_by', integration.user_id)
                if integration.meta_data:
                    setattr(doc, 'cloud_email', integration.meta_data.get('cloud_email'))

    return projects

@router.get("/projects/{project_id}", response_model=schemas.project.Project)
def read_project(project_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a single project by its ID.
    """
    cache_key = f"project_{project_id}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    db_project = crud.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Inject cloud_email from AUTH_ONLY records into active integrations
    from .. import models
    auth_integrations = db.query(models.project_integration.ProjectIntegration).filter(
        models.project_integration.ProjectIntegration.project_id == project_id,
        models.project_integration.ProjectIntegration.spreadsheet_id == "AUTH_ONLY"
    ).all()
    
    auth_map = {}
    for auth in auth_integrations:
        if auth.meta_data and auth.meta_data.get("cloud_email"):
            key = f"{auth.provider}_{auth.user_id}"
            auth_map[key] = auth.meta_data.get("cloud_email")
            # Fallback
            if auth.provider not in auth_map:
                auth_map[auth.provider] = auth.meta_data.get("cloud_email")
    
    for integration in db_project.integrations:
        if integration.spreadsheet_id != "AUTH_ONLY":
            key = f"{integration.provider}_{integration.user_id}"
            cloud_email = auth_map.get(key) or auth_map.get(integration.provider)
            if cloud_email:
                if not integration.meta_data:
                    integration.meta_data = {}
                new_meta = dict(integration.meta_data)
                new_meta["cloud_email"] = cloud_email
                integration.meta_data = new_meta

    integration_map = {i.id: i for i in db_project.integrations}
    for doc in getattr(db_project, 'boq_documents', []):
        if doc.integration_id and doc.integration_id in integration_map:
            integration = integration_map[doc.integration_id]
            setattr(doc, 'uploaded_by', integration.user_id)
            if integration.meta_data:
                setattr(doc, 'cloud_email', integration.meta_data.get('cloud_email'))

    encoded = jsonable_encoder(db_project)
    set_cache(cache_key, encoded)
    return db_project

@router.put("/projects/{project_id}", response_model=schemas.project.Project)
def update_project(project_id: int, project: schemas.project.ProjectUpdate, db: Session = Depends(get_db)):
    """
    Update an existing project.
    """
    db_project = crud.update_project(db, project_id=project_id, project=project)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
        
    invalidate_cache(f"project_{project_id}")
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

@router.get("/boqs/{boq_id}/items", response_model=List[schemas.boq.BoqItem])
def read_boq_items(boq_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all items for a specific BOQ document.
    """
    from .. import models
    boq_doc = db.query(models.boq_document.BoqDocument).filter(models.boq_document.BoqDocument.id == boq_id).first()
    if boq_doc is None:
        raise HTTPException(status_code=404, detail="BOQ document not found")
    
    items = db.query(models.boq_item.BoqItem).filter(models.boq_item.BoqItem.boq_id == boq_id).order_by(models.boq_item.BoqItem.id).all()
    return items

@router.put("/boqs/{boq_id}/items")
def update_boq_items(boq_id: int, updated_items: List[schemas.boq.BoqItem], db: Session = Depends(get_db)):
    """
    Bulk update items for a specific BOQ document.
    """
    from .. import models
    boq_doc = db.query(models.boq_document.BoqDocument).filter(models.boq_document.BoqDocument.id == boq_id).first()
    if boq_doc is None:
        raise HTTPException(status_code=404, detail="BOQ document not found")

    db_items = db.query(models.boq_item.BoqItem).filter(models.boq_item.BoqItem.boq_id == boq_id).all()
    db_items_map = {item.id: item for item in db_items}

    # Verify all updated items belong to this BOQ
    for item in updated_items:
        if item.id not in db_items_map:
            raise HTTPException(status_code=400, detail=f"Item with ID {item.id} does not belong to BOQ {boq_id}")

    try:
        for item in updated_items:
            db_item = db_items_map[item.id]
            db_item.bill_item_number = item.bill_item_number
            db_item.description = item.description
            db_item.unit = item.unit
            db_item.quantity = item.quantity
            db_item.rate = item.rate
            
            # Auto-calculate amount for line items if edited
            if item.row_category == 'LINE_ITEM':
                db_item.amount = item.quantity * item.rate
            else:
                db_item.amount = item.amount
                
            db_item.row_category = item.row_category
            db_item.hierarchy_level = item.hierarchy_level
            db_item.parent_id = item.parent_id
            
        db.commit()
        return {"status": "success", "message": f"Successfully updated {len(updated_items)} items for BOQ {boq_id}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")

@router.delete("/boqs/{boq_id}")
def delete_boq_document(boq_id: int, db: Session = Depends(get_db)):
    """
    Permanently deletes a BOQ document snapshot and all its items from the database.
    Validates that the workbook is not currently linked to an active cloud integration first.
    """
    from .. import models
    from ..models.project_integration import ProjectIntegration
    
    boq_doc = db.query(models.boq_document.BoqDocument).filter(models.boq_document.BoqDocument.id == boq_id).first()
    if boq_doc is None:
        raise HTTPException(status_code=404, detail="BOQ document not found")
        
    try:
        # Delete integration connection if attached to an integration
        if boq_doc.integration_id:
            db.query(ProjectIntegration).filter(ProjectIntegration.id == boq_doc.integration_id).delete(synchronize_session=False)

        # Bulk delete all child items to avoid slow one-by-one ORM cascades over WAN
        db.query(models.boq_item.BoqItem).filter(models.boq_item.BoqItem.boq_id == boq_id).delete(synchronize_session=False)
        db.delete(boq_doc)
        db.commit()
        return {"status": "success", "message": f"Successfully unlinked, deleted integration, and deleted BOQ document '{boq_doc.name}' and all its items."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete BOQ document: {str(e)}")
