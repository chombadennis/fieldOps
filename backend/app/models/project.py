from sqlalchemy import Column, Integer, String, Date
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Project(Base):
    __tablename__ = 'projects'
    project_id = Column(Integer, primary_key=True)
    name = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
