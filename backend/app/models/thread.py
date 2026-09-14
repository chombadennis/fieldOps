from sqlalchemy import Column, Integer, String, Text, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase


class Thread(Base, CustomBase):
    __tablename__ = 'threads'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False, index=True)
    module = Column(String, nullable=False, index=True)  # 'IPC', 'Budget', 'Tech', 'Field Operations', 'HR', 'Legal', 'General'
    subject = Column(String(255), nullable=False)
    status = Column(String(20), default='open')  # open, resolved
    created_by_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    linked_document_ids = Column(ARRAY(Integer), default=[], nullable=True)

    # Relationships
    project = relationship("Project")
    created_by = relationship("User", foreign_keys=[created_by_id])
    replies = relationship("ThreadReply", back_populates="thread", cascade="all, delete-orphan", order_by="ThreadReply.created_at")
