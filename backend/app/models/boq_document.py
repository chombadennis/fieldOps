from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class BoqDocument(Base, CustomBase):
    __tablename__ = 'boq_documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    file_hash = Column(String, nullable=False, index=True)  # SHA-256 fingerprint
    origin = Column(String, nullable=True, default="file_upload")
    headers = Column(JSON, nullable=True, default=None)

    # Relationships
    project = relationship("Project", back_populates="boq_documents")
    boq_items = relationship("BoqItem", back_populates="boq_document", cascade="all, delete-orphan")
