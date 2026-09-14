from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase


class LogEntry(Base, CustomBase):
    __tablename__ = 'log_entries'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False, index=True)
    module = Column(String, nullable=True, index=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete="SET NULL"), nullable=True)
    thread_id = Column(Integer, ForeignKey('threads.id', ondelete="SET NULL"), nullable=True)
    entry_type = Column(String(30), nullable=False)  # Decision, Success, Failure, Risk, Issue, Resolved
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    posted_by_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    posted_by_name = Column(String, nullable=True)  # Denormalised

    # Relationships
    project = relationship("Project")
    task = relationship("Task")
    thread = relationship("Thread")
    posted_by = relationship("User", foreign_keys=[posted_by_id])
