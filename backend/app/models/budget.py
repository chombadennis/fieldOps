from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Budget(Base, CustomBase):
    __tablename__ = 'budgets'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="budgets")
    documents = relationship("Document", back_populates="budget", cascade="all, delete-orphan")

    @property
    def category(self):
        return self.name

    @category.setter
    def category(self, value):
        self.name = value

    @property
    def description(self):
        return self.notes

    @description.setter
    def description(self, value):
        self.notes = value
