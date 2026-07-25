import sqlalchemy.orm
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class ProgramOfWorksDocument(Base, CustomBase):
    __tablename__ = 'program_of_works_documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, default="pdf", nullable=True)
    origin = Column(String, nullable=True, default="file_upload")
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True, index=True)

    items = relationship("ProgramOfWorksItem", back_populates="document", cascade="all, delete-orphan")

class ProgramOfWorksItem(Base, CustomBase):
    __tablename__ = 'program_of_works_items'
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey('program_of_works_documents.id', ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey('program_of_works_items.id', ondelete="SET NULL"), nullable=True)
    
    task_name = Column(String, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    duration_days = Column(Integer, nullable=True)
    percent_complete = Column(Float, nullable=True, default=0.0)
    predecessors = Column(String, nullable=True)
    values_map = Column(JSONB, nullable=True, default=None)
    
    document = relationship("ProgramOfWorksDocument", back_populates="items")
    children = relationship("ProgramOfWorksItem", backref=sqlalchemy.orm.backref('parent', remote_side=[id]))
