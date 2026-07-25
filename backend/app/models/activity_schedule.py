import sqlalchemy.orm
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class ActivityScheduleDocument(Base, CustomBase):
    __tablename__ = 'activity_schedule_documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, default="pdf", nullable=True)
    origin = Column(String, nullable=True, default="file_upload")
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True, index=True)

    items = relationship("ActivityScheduleItem", back_populates="document", cascade="all, delete-orphan")

class ActivityScheduleItem(Base, CustomBase):
    __tablename__ = 'activity_schedule_items'
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey('activity_schedule_documents.id', ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey('activity_schedule_items.id', ondelete="SET NULL"), nullable=True)
    
    activity_id = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=False)
    weight_percentage = Column(Float, nullable=True, default=0.0)
    fixed_price = Column(Float, nullable=True, default=0.0)
    values_map = Column(JSONB, nullable=True, default=None)
    
    document = relationship("ActivityScheduleDocument", back_populates="items")
    children = relationship("ActivityScheduleItem", backref=sqlalchemy.orm.backref('parent', remote_side=[id]))
