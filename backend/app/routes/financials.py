from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
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
def get_project_budgets(project_id: int, contract_id: Optional[int] = None, db: Session = Depends(get_db)):
    from typing import Optional
    from ..models.contract import Contract
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return []

    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract:
            contract_id = general_contract.id

    query = db.query(Budget).filter(Budget.project_id == project_id)
    if contract_id is not None:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract and contract_id == general_contract.id:
            from sqlalchemy import or_
            query = query.filter(or_(Budget.contract_id == contract_id, Budget.contract_id == None))
        else:
            query = query.filter(Budget.contract_id == contract_id)

    budgets = query.order_by(Budget.created_at.desc()).all()

    # Backfill tracking_mode in bundle_config for legacy records missing it
    for b in budgets:
        if b.values_map and isinstance(b.values_map, dict):
            bc = b.values_map.get("bundle_config")
            if bc and isinstance(bc, dict) and "tracking_mode" not in bc:
                bc["tracking_mode"] = "split" if bc.get("expected_count", 1) > 1 else "single"

    return budgets

@router.post("/projects/{project_id}/budgets", response_model=platform_schemas.Budget)
def create_project_budget(project_id: int, budget_in: platform_schemas.BudgetCreate, db: Session = Depends(get_db)):
    from ..models.contract import Contract
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contract_id = budget_in.contract_id
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if not general_contract:
            general_contract = Contract(project_id=project_id, name="General Contract", contract_type="GENERAL")
            db.add(general_contract)
            db.commit()
            db.refresh(general_contract)
        contract_id = general_contract.id

    new_budget = Budget(
        project_id=project_id,
        contract_id=contract_id,
        category=budget_in.category,
        amount=budget_in.amount,
        allocated_date=budget_in.allocated_date,
        description=budget_in.description
    )
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)
    return new_budget

from fastapi import APIRouter, Depends, HTTPException, Body

@router.put("/projects/{project_id}/budgets/{budget_id}", response_model=platform_schemas.Budget)
def update_project_budget(project_id: int, budget_id: int, budget_in: dict = Body(...), db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.project_id == project_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    if "amount" in budget_in:
        budget.amount = budget_in["amount"]
    if "revised_amount" in budget_in:
        budget.revised_amount = budget_in["revised_amount"]
    if "values_map" in budget_in:
        import copy
        current_map = copy.deepcopy(budget.values_map) if budget.values_map else {}
        if "master_cleaned_table" not in current_map:
            current_map["master_cleaned_table"] = {}
        
        updates = budget_in["values_map"]
        if "master_cleaned_table" in updates:
            for k, v in updates["master_cleaned_table"].items():
                current_map["master_cleaned_table"][k] = v
        
        budget.values_map = current_map
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(budget, "values_map")

    db.commit()
    db.refresh(budget)
    return budget

# --- IPCs Endpoints ---
@router.get("/projects/{project_id}/ipcs", response_model=List[platform_schemas.IPC])
def get_project_ipcs(project_id: int, contract_id: Optional[int] = None, db: Session = Depends(get_db)):
    from typing import Optional
    from ..models.contract import Contract
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract:
            contract_id = general_contract.id

    query = db.query(IPC).filter(IPC.project_id == project_id)
    if contract_id is not None:
        query = query.filter(IPC.contract_id == contract_id)

    return query.order_by(IPC.created_at.desc()).all()

@router.post("/projects/{project_id}/ipcs", response_model=platform_schemas.IPC)
def create_project_ipc(project_id: int, ipc_in: platform_schemas.IPCCreate, db: Session = Depends(get_db)):
    from ..models.contract import Contract
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contract_id = ipc_in.contract_id
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if not general_contract:
            general_contract = Contract(project_id=project_id, name="General Contract", contract_type="GENERAL")
            db.add(general_contract)
            db.commit()
            db.refresh(general_contract)
        contract_id = general_contract.id

    new_ipc = IPC(
        project_id=project_id,
        contract_id=contract_id,
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
