from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class Budget(Base, CustomBase):
    __tablename__ = 'budgets'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=False)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    revised_amount = Column(Float, nullable=True)
    planned_value = Column(Float, nullable=True)
    earned_value = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)
    values_map = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="budgets")
    contract = relationship("Contract", back_populates="budgets")

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
