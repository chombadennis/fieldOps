from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class ActivityLog(Base):
    __tablename__ = 'activity_logs'
    log_id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.project_id'))
    date = Column(Date)
    supervisor_text = Column(String)
