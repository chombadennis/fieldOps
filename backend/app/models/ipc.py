from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class IPC(Base, CustomBase):
    __tablename__ = 'ipcs'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    certificate_number = Column(String, nullable=False, index=True)
    amount_claimed = Column(Float, nullable=False)
    amount_certified = Column(Float, nullable=True)
    status = Column(String, default="pending", nullable=False) # pending, certified, paid
    date_issued = Column(Date, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="ipcs")
    documents = relationship("Document", back_populates="ipc", cascade="all, delete-orphan")
