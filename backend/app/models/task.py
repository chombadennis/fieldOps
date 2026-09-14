from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase


class Task(Base, CustomBase):
    __tablename__ = 'tasks'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False, index=True)
    module = Column(String, nullable=True, index=True)  # 'IPC', 'Budget', 'Tech', etc.
    thread_id = Column(Integer, ForeignKey('threads.id', ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assigned_to_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    assigned_to_name = Column(String, nullable=True)  # Denormalised
    created_by_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    due_date = Column(Date, nullable=True)
    reminder_at = Column(DateTime, nullable=True)
    priority = Column(String(20), default='Normal')  # Low, Normal, High, Critical
    status = Column(String(30), default='Open')  # Open, In Progress, Blocked, Done, Failed
    resolution_note = Column(Text, nullable=True)  # required when status = Failed
    completed_at = Column(DateTime, nullable=True)
    linked_document_ids = Column(ARRAY(Integer), default=[], nullable=True)

    # Relationships
    project = relationship("Project")
    thread = relationship("Thread")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
