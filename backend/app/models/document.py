from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from .base import CustomBase

class Document(Base, CustomBase):
    __tablename__ = 'documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    origin = Column(String, default="file_upload", nullable=False) # e.g. "file_upload", "google_drive", "onedrive"
    cloud_file_id = Column(String, nullable=True)
    department = Column(String, nullable=True, index=True) # Optional department classification: e.g. "hr", "legal", "tech", "field_ops"
    file_type = Column(String, default="pdf", nullable=True)
    file_size = Column(Integer, default=0, nullable=True)
    # Link to the OAuth integration that provided this document (for embed URL generation)
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True)
    
    is_linked = Column(Boolean, default=True, nullable=False)
    linked_at = Column(DateTime, default=func.now(), nullable=True)
    unlinked_at = Column(DateTime, nullable=True)

    note_id = Column(Integer, ForeignKey('notes.id', ondelete="SET NULL"), nullable=True)
    budget_id = Column(Integer, ForeignKey('budgets.id', ondelete="SET NULL"), nullable=True)
    ipc_id = Column(Integer, ForeignKey('ipcs.id', ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="documents")
    contract = relationship("Contract", back_populates="documents")
    note = relationship("Note", back_populates="documents")
    budget = relationship("Budget", back_populates="documents")
    ipc = relationship("IPC", back_populates="documents")

    @property
    def title(self):
        return self.name

    @title.setter
    def title(self, value):
        self.name = value
