from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class BoqItem(Base):
    __tablename__ = 'boq_items'
    item_id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.project_id'))
    sheet_name = Column(String)
    description = Column(String)
    unit = Column(String)
    rate = Column(Float)
    budget_qty = Column(Float)
