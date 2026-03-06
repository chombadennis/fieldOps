from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)

    activities = relationship("Activity", back_populates="project")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    project_id = Column(Integer, ForeignKey("projects.id"))

    project = relationship("Project", back_populates="activities")
