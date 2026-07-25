from app.db.database import SessionLocal
from app.models.document import Document
from app.models.tech import TechDocument
from app.models.field_ops import FieldOpsDocument
from app.models.ipc_document import IpcDocument
from app.models.budget_document import BudgetDocument
from app.models.activity_schedule import ActivityScheduleDocument
from app.models.milestone_claim import MilestoneClaimDocument
from app.models.rate_schedule import RateScheduleDocument
from app.models.reimbursable_claim import ReimbursableClaimDocument
from app.models.program_of_works import ProgramOfWorksDocument
from app.models.boq_document import BoqDocument

db = SessionLocal()

print("="*80)
print("COMPREHENSIVE DATABASE DOCUMENTS REPORT")
print("="*80)

def print_docs(docs, location):
    if not docs:
        return
    print(f"\n--- {location.upper()} ---")
    for d in docs:
        # Get all columns from the SQLAlchemy object
        attrs = []
        for column in d.__table__.columns:
            val = getattr(d, column.name)
            if column.name in ['metadata_map', 'headers', 'values_map']:
                # Trucate large JSON objects
                val = str(val)[:100] + '...' if val and len(str(val)) > 100 else val
            attrs.append(f"{column.name}={val}")
        
        print(" | ".join(attrs))

try:
    print_docs(db.query(Document).all(), "documents (Generic HR/Legal)")
    print_docs(db.query(TechDocument).all(), "tech_documents")
    print_docs(db.query(FieldOpsDocument).all(), "field_ops_documents")
    print_docs(db.query(IpcDocument).all(), "ipc_documents")
    print_docs(db.query(BudgetDocument).all(), "budget_documents")
    print_docs(db.query(ActivityScheduleDocument).all(), "activity_schedule_documents")
    print_docs(db.query(MilestoneClaimDocument).all(), "milestone_claim_documents")
    print_docs(db.query(RateScheduleDocument).all(), "rate_schedule_documents")
    print_docs(db.query(ReimbursableClaimDocument).all(), "reimbursable_claim_documents")
    print_docs(db.query(ProgramOfWorksDocument).all(), "program_of_works_documents")
    print_docs(db.query(BoqDocument).all(), "boq_documents")
except Exception as e:
    print(f"Error querying: {e}")
finally:
    db.close()
