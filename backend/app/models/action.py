from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Action(Base, CustomBase):
    __tablename__ = 'actions'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    document_id = Column(Integer, ForeignKey('documents.id', ondelete="CASCADE"), nullable=True)
    decision_id = Column(Integer, ForeignKey('decisions.id', ondelete="CASCADE"), nullable=True)
    description = Column(Text, nullable=False)
    assignee_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String, default="Pending") # Pending, In Progress, Completed

    # Relationships
    project = relationship("Project")
    document = relationship("Document")
    decision = relationship("Decision", back_populates="actions")
    assignee = relationship("User")
