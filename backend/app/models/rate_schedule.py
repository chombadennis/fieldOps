from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class RateScheduleDocument(Base, CustomBase):
    __tablename__ = 'rate_schedule_documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, default="pdf", nullable=True)
    origin = Column(String, nullable=True, default="file_upload")
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True, index=True)

    items = relationship("RateScheduleItem", back_populates="document", cascade="all, delete-orphan")

class RateScheduleItem(Base, CustomBase):
    __tablename__ = 'rate_schedule_items'
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey('rate_schedule_documents.id', ondelete="CASCADE"), nullable=False)
    
    resource_category = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=False)
    base_cost = Column(Float, nullable=True, default=0.0)
    markup_percentage = Column(Float, nullable=True, default=0.0)
    hourly_daily_rate = Column(Float, nullable=True, default=0.0)
    values_map = Column(JSONB, nullable=True, default=None)
    
    document = relationship("RateScheduleDocument", back_populates="items")
