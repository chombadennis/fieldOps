import logging
from app.db.database import SessionLocal
from app.models.document import Document
from app.models.tech import TechDocument
from app.models.field_ops import FieldOpsDocument
from app.models.ipc_document import IpcDocument
from app.models.ipc import IPC

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

db = SessionLocal()

try:
    docs = db.query(Document).filter(Document.department.in_(['IPC', 'Tech', 'Field Operations'])).all()
    
    for doc in docs:
        logger.info(f"Migrating Document: {doc.name} (Dept: {doc.department})")
        
        if doc.department == 'Tech':
            new_doc = TechDocument(
                project_id=doc.project_id,
                contract_id=doc.contract_id,
                name=doc.name,
                file_url=doc.file_url,
                file_type=doc.file_type,
                origin=doc.origin,
                integration_id=doc.integration_id
            )
            db.add(new_doc)
            db.delete(doc)
            
        elif doc.department == 'Field Operations':
            new_doc = FieldOpsDocument(
                project_id=doc.project_id,
                contract_id=doc.contract_id,
                name=doc.name,
                file_url=doc.file_url,
                file_type=doc.file_type,
                origin=doc.origin,
                integration_id=doc.integration_id
            )
            db.add(new_doc)
            db.delete(doc)
            
        elif doc.department == 'IPC':
            # Need an ipc_id. Find one for this project.
            ipc = db.query(IPC).filter(IPC.project_id == doc.project_id).first()
            if not ipc:
                logger.info(f"Creating default IPC for project {doc.project_id}")
                ipc = IPC(
                    project_id=doc.project_id,
                    contract_id=doc.contract_id,
                    certificate_number="MIGRATED-IPC-1",
                    amount_claimed=0.0
                )
                db.add(ipc)
                db.flush() # get id
                
            new_doc = IpcDocument(
                ipc_id=ipc.id,
                name=doc.name,
                file_url=doc.file_url,
                file_type=doc.file_type,
                origin=doc.origin,
                integration_id=doc.integration_id
            )
            db.add(new_doc)
            db.delete(doc)
            
    db.commit()
    logger.info("Migration completed successfully!")
except Exception as e:
    db.rollback()
    logger.error(f"Migration failed: {e}")
finally:
    db.close()
