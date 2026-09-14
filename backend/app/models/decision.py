from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Decision(Base, CustomBase):
    __tablename__ = 'decisions'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    document_id = Column(Integer, ForeignKey('documents.id', ondelete="CASCADE"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    made_by_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    made_on = Column(Date, nullable=True)
    status = Column(String, default="Approved") # Proposed, Approved, Reversed

    # Relationships
    project = relationship("Project")
    document = relationship("Document")
    made_by = relationship("User")
    actions = relationship("Action", back_populates="decision", cascade="all, delete-orphan")
