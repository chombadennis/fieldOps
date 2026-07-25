from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class FieldOpsDocument(Base, CustomBase):
    __tablename__ = 'field_ops_documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, default="pdf", nullable=True)
    origin = Column(String, nullable=True, default="file_upload")
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True, index=True)

    items = relationship("FieldOpsItem", back_populates="document", cascade="all, delete-orphan")

class FieldOpsItem(Base, CustomBase):
    __tablename__ = 'field_ops_items'
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey('field_ops_documents.id', ondelete="CASCADE"), nullable=False)
    
    description = Column(Text, nullable=False)
    values_map = Column(JSONB, nullable=True, default=None)
    
    document = relationship("FieldOpsDocument", back_populates="items")
