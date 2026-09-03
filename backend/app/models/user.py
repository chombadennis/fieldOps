from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class User(Base, CustomBase):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="engineer") # e.g. "admin", "engineer", "hr", "legal", "field_officer"
    company_id = Column(Integer, ForeignKey('companies.id', ondelete="CASCADE"), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="users")
    notes = relationship("Note", back_populates="author", cascade="all, delete-orphan")
    integrations = relationship("ProjectIntegration", back_populates="user", cascade="all, delete-orphan")
