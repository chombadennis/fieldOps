from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import schemas, models
from ..db import database

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/projects/{project_id}/contracts", response_model=schemas.contract.Contract)
def create_contract(project_id: int, contract: schemas.contract.ContractCreate, db: Session = Depends(get_db)):
    """
    Create a new contract under a project.
    """
    # Verify project exists
    project = db.query(models.project.Project).filter(models.project.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_contract = models.contract.Contract(
        project_id=project_id,
        name=contract.name,
        contract_type=contract.contract_type,
        contractor_name=contract.contractor_name,
        contract_value=contract.contract_value,
        start_date=contract.start_date,
        end_date=contract.end_date,
        status=contract.status or "active"
    )
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract

@router.get("/projects/{project_id}/contracts", response_model=List[schemas.contract.Contract])
def read_contracts(project_id: int, db: Session = Depends(get_db)):
    """
    Retrieve all contracts under a project.
    """
    # Verify project exists
    project = db.query(models.project.Project).filter(models.project.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return db.query(models.contract.Contract).filter(models.contract.Contract.project_id == project_id).all()

@router.get("/contracts/{contract_id}", response_model=schemas.contract.Contract)
def read_contract(contract_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a single contract by its ID.
    """
    db_contract = db.query(models.contract.Contract).filter(models.contract.Contract.id == contract_id).first()
    if db_contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return db_contract

@router.put("/contracts/{contract_id}", response_model=schemas.contract.Contract)
def update_contract(contract_id: int, contract: schemas.contract.ContractUpdate, db: Session = Depends(get_db)):
    """
    Update an existing contract.
    """
    db_contract = db.query(models.contract.Contract).filter(models.contract.Contract.id == contract_id).first()
    if db_contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    update_data = contract.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_contract, key, value)
    db.commit()
    db.refresh(db_contract)
    return db_contract

@router.delete("/contracts/{contract_id}", response_model=schemas.contract.Contract)
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    """
    Delete a contract.
    """
    db_contract = db.query(models.contract.Contract).filter(models.contract.Contract.id == contract_id).first()
    if db_contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    db.delete(db_contract)
    db.commit()
    return db_contract
