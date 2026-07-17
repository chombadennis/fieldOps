from pydantic import BaseModel
from typing import Optional

class BoqItemBase(BaseModel):
    bill_item_number: Optional[str] = None
    description: str
    unit: Optional[str] = None
    quantity: float = 0.0
    rate: float = 0.0
    amount: float = 0.0
    row_category: str = 'LINE_ITEM'
    hierarchy_level: int = -1
    mapping_code: Optional[str] = None
    sheet_row_index: Optional[int] = None
    parent_id: Optional[int] = None

class BoqItem(BoqItemBase):
    id: int
    boq_id: int

    class Config:
        from_attributes = True
