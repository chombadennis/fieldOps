from sqlalchemy import Column, Integer, String, Date, Text
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Project(Base, CustomBase):
    __tablename__ = 'projects'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    location = Column(String, nullable=True)
    client_name = Column(String, nullable=True) # From cover pages
    report_date = Column(String, nullable=True) # From cover pages
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # Relationships pointing to the related tables
    boq_items = relationship("BoqItem", back_populates="project", cascade="all, delete-orphan")
    production_reports = relationship("ProductionReport", back_populates="project", cascade="all, delete-orphan")
