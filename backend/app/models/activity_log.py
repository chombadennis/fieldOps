from sqlalchemy import Column, Integer, String, Date, ForeignKey
from ..db.database import Base
from .base import CustomBase

class ActivityLog(Base, CustomBase):
    __tablename__ = 'activity_logs'
    log_id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    date = Column(Date)
    supervisor_text = Column(String)
