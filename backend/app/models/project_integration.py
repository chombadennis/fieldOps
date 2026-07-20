from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base
from .base import CustomBase

class ProjectIntegration(Base, CustomBase):
    __tablename__ = 'project_integrations'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    provider = Column(String, nullable=False)  # 'google_sheets' or 'onedrive'
    spreadsheet_id = Column(String, nullable=False)
    refresh_token = Column(Text, nullable=False)  # Securely encrypted using Fernet
    sheet_name = Column(String, nullable=False, default='Sheet1')
    boq_name = Column(String, nullable=True, default=None)
    last_synced_at = Column(DateTime, nullable=True)
    dismissed_sheets = Column(Text, nullable=True, default=None)  # JSON list of sheet names user has permanently dismissed

    # Relationships
    project = relationship("Project", back_populates="integrations")
    boq_documents = relationship("BoqDocument", foreign_keys="BoqDocument.integration_id", backref="integration", lazy="select")

    # Computed properties read from the linked BoqDocument (most recent one)
    @property
    def _linked_doc(self):
        if self.boq_documents:
            return sorted(self.boq_documents, key=lambda d: d.id, reverse=True)[0]
        return None

    @property
    def preview_only(self):
        doc = self._linked_doc
        return doc.preview_only if doc else False

    @property
    def validation_status(self):
        doc = self._linked_doc
        return doc.validation_status if doc else None

    @property
    def validation_score(self):
        doc = self._linked_doc
        return doc.validation_score if doc else None

    @property
    def validation_issues(self):
        doc = self._linked_doc
        return doc.validation_issues if doc else None

    @property
    def validation_summary(self):
        doc = self._linked_doc
        return doc.validation_summary if doc else None

