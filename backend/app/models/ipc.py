from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class IPC(Base, CustomBase):
    __tablename__ = 'ipcs'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    certificate_number = Column(String, nullable=False, index=True)
    
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    valuation_date = Column(Date, nullable=True)
    
    gross_amount_claimed = Column(Float, nullable=True)
    gross_amount_certified = Column(Float, nullable=True)
    total_deductions = Column(Float, nullable=True)
    net_amount_due = Column(Float, nullable=True)
    cumulative_certified = Column(Float, nullable=True)
    
    status = Column(String, default="Draft", nullable=False) # Draft, Submitted, Certified, Paid
    payment_status = Column(String, default="UNPAID", nullable=False) # UNPAID, PARTIALLY_PAID, PAID
    unpaid_amount = Column(Float, nullable=True)
    payment_date = Column(Date, nullable=True)
    payment_reference = Column(String, nullable=True)
    
    values_map = Column(JSONB, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="ipcs")
    contract = relationship("Contract", back_populates="ipcs")
