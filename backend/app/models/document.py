from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Text, ARRAY, JSON
from sqlalchemy.dialects.postgresql import JSONB
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
    
    uploaded_by = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    
    is_linked = Column(Boolean, default=True, nullable=False)
    linked_at = Column(DateTime, default=func.now(), nullable=True)
    unlinked_at = Column(DateTime, nullable=True)

    # Phase 1: Artifact context — editable on the linked document card after linking
    context_description = Column(Text, nullable=True)       # What is this document?
    link_reason = Column(String(255), nullable=True)        # Why was it linked? e.g. "Budget revision"
    review_requested_from = Column(ARRAY(Integer), nullable=True)  # User IDs to review

    note_id = Column(Integer, ForeignKey('notes.id', ondelete="SET NULL"), nullable=True)
    metadata_map = Column(JSONB, nullable=True)

    # Phase 4: Revision Tracking
    supersedes_id = Column(Integer, ForeignKey('documents.id', ondelete="SET NULL"), nullable=True)
    revision_label = Column(String(50), nullable=True) # e.g. "v2.0", "Revised BoQ"
    is_archived = Column(Boolean, default=False, nullable=False)
    
    # Phase 6: Nine Questions Panel
    ai_insights = Column(JSON, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="documents")
    contract = relationship("Contract", back_populates="documents")
    
    # The note this document was uploaded with
    note = relationship("Note", back_populates="documents", foreign_keys=[note_id])
    
    # Phase 2: Discussions specifically scoped to this artifact
    notes = relationship("Note", back_populates="document_ref", foreign_keys="[Note.document_id]", cascade="all, delete-orphan")
    
    # Phase 4: Self-referential relationship for supersession chain
    supersedes = relationship("Document", remote_side=[id], backref="superseded_by")

    uploader = relationship("User")
    integration = relationship("ProjectIntegration")

    @property
    def cloud_email(self):
        if self.integration and self.integration.meta_data:
            return self.integration.meta_data.get('cloud_email')
        return None

    @property
    def title(self):
        return self.name

    @title.setter
    def title(self, value):
        self.name = value

    @property
    def extracted_data(self):
        return self.metadata_map

    @extracted_data.setter
    def extracted_data(self, value):
        self.metadata_map = value
