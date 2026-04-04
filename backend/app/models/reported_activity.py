from sqlalchemy import Column, Integer, Float, ForeignKey, String
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class ReportedActivity(Base, CustomBase):
    __tablename__ = 'reported_activities'
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey('production_reports.id', ondelete="CASCADE"), nullable=False)
    boq_item_id = Column(Integer, ForeignKey('boq_items.id', ondelete="CASCADE"), nullable=False)
    
    # The progress made
    reported_quantity = Column(Float, nullable=False)
    notes = Column(String, nullable=True)  # Context from the foreman if necessary
    
    # Relationships
    report = relationship("ProductionReport", back_populates="reported_activities")
    boq_item = relationship("BoqItem", back_populates="reported_activities")
