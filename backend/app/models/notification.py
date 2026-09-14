from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase


class Notification(Base, CustomBase):
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"), nullable=False, index=True)
    notif_type = Column(String(50), nullable=False)  # task_assigned, reply_received, mention, task_due, thread_resolved
    reference_id = Column(Integer, nullable=True)
    reference_type = Column(String(30), nullable=True)  # thread, task, log_entry
    message = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False)

    # Relationships
    user = relationship("User")
