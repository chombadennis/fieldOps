from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class ContractBase(BaseModel):
    name: str
    contract_type: str  # GENERAL, UNIT_PRICE, LUMP_SUM, COST_PLUS, DESIGN_BUILD
    contractor_name: Optional[str] = None
    contract_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "active"

class ContractCreate(ContractBase):
    pass

class ContractUpdate(BaseModel):
    name: Optional[str] = None
    contract_type: Optional[str] = None
    contractor_name: Optional[str] = None
    contract_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

class Contract(ContractBase):
    id: int
    project_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
