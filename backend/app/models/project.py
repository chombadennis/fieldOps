from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Project(Base, CustomBase):
    __tablename__ = 'projects'
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey('companies.id', ondelete="CASCADE"), nullable=True)
    name = Column(String, index=True, nullable=False)
    location = Column(String, nullable=True)
    client_name = Column(String, nullable=True) # From cover pages

    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # Relationships pointing to the related tables
    company = relationship("Company", back_populates="projects")
    boq_documents = relationship("BoqDocument", back_populates="project", cascade="all, delete-orphan")
    integrations = relationship("ProjectIntegration", back_populates="project", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="project", cascade="all, delete-orphan")
    ipcs = relationship("IPC", back_populates="project", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
