from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from ..db.database import Base
from .base import CustomBase
from sqlalchemy.orm import relationship

class IpcDocument(Base, CustomBase):
    __tablename__ = 'ipc_documents'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete="CASCADE"), nullable=True, index=True)
    contract_id = Column(Integer, ForeignKey('contracts.id', ondelete="CASCADE"), nullable=True, index=True)
    ipc_id = Column(Integer, ForeignKey('ipcs.id', ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, default="pdf", nullable=True)
    file_size = Column(Integer, default=0)
    cloud_file_id = Column(String, nullable=True, index=True)
    origin = Column(String, nullable=True, default="file_upload")
    integration_id = Column(Integer, ForeignKey('project_integrations.id', ondelete="SET NULL"), nullable=True, index=True)
    is_linked = Column(Boolean, default=True)
    linked_at = Column(DateTime, nullable=True)
    unlinked_at = Column(DateTime, nullable=True)

    ipc = relationship("IPC", backref="documents")
