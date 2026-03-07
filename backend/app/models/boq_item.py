from sqlalchemy import Column, Integer, String, Float, ForeignKey
from ..db.database import Base
from .base import CustomBase

class BoqItem(Base, CustomBase):
    __tablename__ = 'boq_items'
    item_id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    sheet_name = Column(String)
    description = Column(String)
    unit = Column(String)
    rate = Column(Float)
    budget_qty = Column(Float)
