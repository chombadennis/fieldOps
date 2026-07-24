from sqlalchemy import Column, Integer, String, ForeignKey, Float, Date
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Contract(Base, CustomBase):
    __tablename__ = 'contracts'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    contract_type = Column(String, nullable=False, index=True) # e.g. "GENERAL", "UNIT_PRICE", "LUMP_SUM", "COST_PLUS", "DESIGN_BUILD"
    contractor_name = Column(String, nullable=True)
    contract_value = Column(Float, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String, default="active", nullable=False)

    # Relationships
    project = relationship("Project", back_populates="contracts")
    
    # Cascade deletes to all items under the contract
    boq_documents = relationship("BoqDocument", backref="contract", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="contract", cascade="all, delete-orphan")
    ipcs = relationship("IPC", back_populates="contract", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="contract", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="contract", cascade="all, delete-orphan")
    integrations = relationship("ProjectIntegration", backref="contract", cascade="all, delete-orphan")
