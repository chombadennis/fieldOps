from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import database
from ..models.budget import Budget
from ..models.ipc import IPC
from ..models.project import Project
from ..schemas import platform as platform_schemas

router = APIRouter()

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Budgets Endpoints ---
@router.get("/projects/{project_id}/budgets", response_model=List[platform_schemas.Budget])
def get_project_budgets(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return db.query(Budget).filter(Budget.project_id == project_id).order_by(Budget.created_at.desc()).all()

@router.post("/projects/{project_id}/budgets", response_model=platform_schemas.Budget)
def create_project_budget(project_id: int, budget_in: platform_schemas.BudgetCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_budget = Budget(
        project_id=project_id,
        category=budget_in.category,
        amount=budget_in.amount,
        allocated_date=budget_in.allocated_date,
        description=budget_in.description
    )
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)
    return new_budget

# --- IPCs Endpoints ---
@router.get("/projects/{project_id}/ipcs", response_model=List[platform_schemas.IPC])
def get_project_ipcs(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return db.query(IPC).filter(IPC.project_id == project_id).order_by(IPC.created_at.desc()).all()

@router.post("/projects/{project_id}/ipcs", response_model=platform_schemas.IPC)
def create_project_ipc(project_id: int, ipc_in: platform_schemas.IPCCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_ipc = IPC(
        project_id=project_id,
        certificate_number=ipc_in.certificate_number,
        amount_claimed=ipc_in.amount_claimed,
        amount_certified=ipc_in.amount_certified or 0.0,
        status=ipc_in.status,
        issued_date=ipc_in.issued_date,
        period_start=ipc_in.period_start,
        period_end=ipc_in.period_end
    )
    db.add(new_ipc)
    db.commit()
    db.refresh(new_ipc)
    return new_ipc
