from sqlalchemy import Column, Integer, String, Text, Boolean, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Note(Base, CustomBase):
    __tablename__ = 'notes'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey('documents.id', ondelete="CASCADE"), nullable=True, index=True)
    author_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    department = Column(String, nullable=False, index=True) # e.g. "hr", "legal", "tech", "field_ops", "general", "boq", "ipc", "budget"
    content = Column(Text, nullable=False)
    is_issue = Column(Boolean, default=False, nullable=False)
    priority = Column(String, default="Normal", nullable=True)
    follow_up_date = Column(Date, nullable=True)
    values_map = Column(JSONB, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="notes")
    contract = relationship("Contract", back_populates="notes")
    author = relationship("User", back_populates="notes")
    
    # Existing relationship: Documents that were created with this note as a comment
    documents = relationship("Document", back_populates="note", cascade="all, delete-orphan", foreign_keys="[Document.note_id]")
    
    # Phase 2: The artifact this discussion thread is about
    document_ref = relationship("Document", back_populates="notes", foreign_keys=[document_id])
