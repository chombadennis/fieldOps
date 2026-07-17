from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
import sqlalchemy.orm
from sqlalchemy.orm import relationship
from ..db.database import Base
from .base import CustomBase

class BoqItem(Base, CustomBase):
    __tablename__ = 'boq_items'
    
    id = Column(Integer, primary_key=True, index=True)
    boq_id = Column(Integer, ForeignKey('boq_documents.id', ondelete="CASCADE"), nullable=False)
    
    # --- NEW: HIERARCHY SUPPORT ---
    # This allows recursive parenting: Bill -> Element -> Sub-heading -> Item
    parent_id = Column(Integer, ForeignKey('boq_items.id', ondelete="SET NULL"), nullable=True)
    
    # Category of the row (e.g., 'BILL_HEADER', 'ELEMENT_HEADER', 'SUB_HEADER', 'LINE_ITEM')
    row_category = Column(String, index=True, default='LINE_ITEM')
    
    # AI-predicted depth (0 = Bill, 1 = Element, 2 = Subheading, etc)
    hierarchy_level = Column(Integer, default=-1)
    
    # Mapping field for External Specifications (e.g. Roads, Bridges, Building Works spec code)
    mapping_code = Column(String, index=True, nullable=True)
    
    # Mapping for cloud spreadsheets (Google Sheets, Excel on OneDrive)
    sheet_row_index = Column(Integer, nullable=True, default=None)
    sheet_id = Column(String, nullable=True, default=None)
    sheet_name = Column(String, nullable=True, default=None)
    values_map = Column(JSONB, nullable=True, default=None)
    # ------------------------------

    # Core BOQ Fields from the AI
    bill_item_number = Column(String, index=True, nullable=True) # e.g. "3.1.4"
    description = Column(Text, nullable=False)
    unit = Column(String, nullable=True)
    quantity = Column(Float, nullable=False, default=0.0)
    rate = Column(Float, nullable=False, default=0.0)
    amount = Column(Float, nullable=False, default=0.0)
    
    # Relationships
    boq_document = relationship("BoqDocument", back_populates="boq_items")
    children = relationship("BoqItem", backref=sqlalchemy.orm.backref('parent', remote_side=[id]))
    reported_activities = relationship("ReportedActivity", back_populates="boq_item", cascade="all, delete-orphan")
