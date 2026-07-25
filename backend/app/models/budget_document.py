from sqlalchemy import Column, Integer, String, ForeignKey
from ..db.database import Base
from .base import CustomBase
from sqlalchemy.orm import relationship

class BudgetDocument(Base, CustomBase):
    __tablename__ = 'budget_documents'

    id = Column(Integer, primary_key=True, index=True)
    budget_id = Column(Integer, ForeignKey('budgets.id', ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, default="pdf", nullable=True)
    origin = Column(String, nullable=True, default="file_upload")
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True, index=True)

    budget = relationship("Budget", backref="documents")
