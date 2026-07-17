from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Company(Base, CustomBase):
    __tablename__ = 'companies'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)

    # Relationships
    projects = relationship("Project", back_populates="company", cascade="all, delete-orphan")
