from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, ARRAY
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase


class ThreadReply(Base, CustomBase):
    __tablename__ = 'thread_replies'

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey('threads.id', ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    author_name = Column(String, nullable=True)  # Denormalised for fast display
    is_issue = Column(Boolean, default=False)
    # mentions stored as JSON array of user_ids in values_map to avoid pg array complexity
    mentions_raw = Column(String, nullable=True)  # comma-separated user ids

    # Relationships
    thread = relationship("Thread", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id])
