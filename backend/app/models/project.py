from sqlalchemy import Column, Integer, String, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Project(Base, CustomBase):
    __tablename__ = 'projects'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    start_date = Column(Date)
    end_date = Column(Date)

    activities = relationship("Activity", back_populates="project")
