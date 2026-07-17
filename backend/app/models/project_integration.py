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

    # Relationships
    project = relationship("Project", back_populates="integrations")
