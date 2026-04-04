from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class ProductionReport(Base, CustomBase):
    __tablename__ = 'production_reports'
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    
    date = Column(Date, nullable=False, default=func.current_date())
    uploaded_by = Column(String, nullable=False) # e.g., email or username
    notes = Column(String, nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="production_reports")
    reported_activities = relationship("ReportedActivity", back_populates="report", cascade="all, delete-orphan")
