from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class ContractBase(BaseModel):
    name: str
    contract_type: str  # GENERAL, UNIT_PRICE, LUMP_SUM, COST_PLUS, DESIGN_BUILD
    contractor_name: Optional[str] = None
    contract_value: Optional[float] = None
    revised_contract_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "active"
    
    # IPC Configuration Defaults
    retention_rate: Optional[float] = 0.05
    max_retention_limit: Optional[float] = None
    vat_rate: Optional[float] = 0.16
    withholding_tax_rate: Optional[float] = 0.03
    withholding_vat_rate: Optional[str] = "0.02"
    advance_payment_amount: Optional[float] = 0.0

class ContractCreate(ContractBase):
    pass

class ContractUpdate(BaseModel):
    name: Optional[str] = None
    contract_type: Optional[str] = None
    contractor_name: Optional[str] = None
    contract_value: Optional[float] = None
    revised_contract_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    
    retention_rate: Optional[float] = None
    max_retention_limit: Optional[float] = None
    vat_rate: Optional[float] = None
    withholding_tax_rate: Optional[float] = None
    withholding_vat_rate: Optional[str] = None
    advance_payment_amount: Optional[float] = None

class Contract(ContractBase):
    id: int
    project_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
