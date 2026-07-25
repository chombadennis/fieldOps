import os

ROUTERS = [
    {
        "name": "tech",
        "model": "TechDocument",
        "import_path": "tech",
        "tag": "Tech Documents"
    },
    {
        "name": "field_ops",
        "model": "FieldOpsDocument",
        "import_path": "field_ops",
        "tag": "Field Ops Documents"
    },
    {
        "name": "budget",
        "model": "BudgetDocument",
        "import_path": "budget_document",
        "tag": "Budget Documents"
    },
    {
        "name": "ipc",
        "model": "IpcDocument",
        "import_path": "ipc_document",
        "tag": "IPC Documents"
    },
    {
        "name": "activity_schedule",
        "model": "ActivityScheduleDocument",
        "import_path": "activity_schedule",
        "tag": "Activity Schedule Documents"
    },
    {
        "name": "milestone_claims",
        "model": "MilestoneClaimDocument",
        "import_path": "milestone_claim",
        "tag": "Milestone Claim Documents"
    },
    {
        "name": "rate_schedule",
        "model": "RateScheduleDocument",
        "import_path": "rate_schedule",
        "tag": "Rate Schedule Documents"
    },
    {
        "name": "reimbursable_claims",
        "model": "ReimbursableClaimDocument",
        "import_path": "reimbursable_claim",
        "tag": "Reimbursable Claim Documents"
    },
    {
        "name": "program_of_works",
        "model": "ProgramOfWorksDocument",
        "import_path": "program_of_works",
        "tag": "Program Of Works Documents"
    }
]

TEMPLATE = """from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.database import get_db
from ..models.{import_path} import {model}
from ..models.project import Project
from ..models.contract import Contract
from ..schemas import platform as platform_schemas
from sqlalchemy.sql import func

router = APIRouter(
    prefix="/projects/{{project_id}}/{name}",
    tags=["{tag}"]
)

@router.get("", response_model=List[platform_schemas.Document])
def get_{name}_documents(
    project_id: int,
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if general_contract:
            contract_id = general_contract.id

    query = db.query({model})
    if hasattr({model}, 'project_id'):
        query = query.filter({model}.project_id == project_id)
        
    if hasattr({model}, 'contract_id') and contract_id is not None:
        query = query.filter({model}.contract_id == contract_id)

    docs = query.order_by({model}.created_at.desc()).all()
    result = []
    for d in docs:
        result.append(
            platform_schemas.Document(
                id=d.id,
                project_id=getattr(d, 'project_id', project_id),
                contract_id=getattr(d, 'contract_id', None),
                title=d.name,
                file_url=d.file_url or "",
                file_type=d.file_type or "unknown",
                department="{name}",
                file_size=getattr(d, 'file_size', 0),
                cloud_file_id=getattr(d, 'cloud_file_id', None),
                origin=d.origin or "file_upload",
                integration_id=d.integration_id,
                is_linked=getattr(d, 'is_linked', True),
                linked_at=getattr(d, 'linked_at', None),
                unlinked_at=getattr(d, 'unlinked_at', None),
                created_at=getattr(d, 'created_at', None)
            )
        )
    return result

@router.post("", response_model=platform_schemas.Document)
def create_{name}_document(
    project_id: int,
    doc_in: platform_schemas.DocumentCreate,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    contract_id = doc_in.contract_id
    if contract_id is not None:
        contract = db.query(Contract).filter(Contract.id == contract_id, Contract.project_id == project_id).first()
        if not contract:
            raise HTTPException(status_code=400, detail="Contract does not belong to this project")
    else:
        general_contract = db.query(Contract).filter(Contract.project_id == project_id, Contract.contract_type == "GENERAL").first()
        if not general_contract:
            general_contract = Contract(project_id=project_id, name="General Contract", contract_type="GENERAL")
            db.add(general_contract)
            db.commit()
            db.refresh(general_contract)
        contract_id = general_contract.id

    # Check for duplicates based on URL or Cloud ID
    existing_doc = None
    query = db.query({model})
    
    # We must filter by the correct foreign keys based on model schema
    if hasattr({model}, 'project_id'):
        query = query.filter({model}.project_id == project_id)
    if hasattr({model}, 'contract_id'):
        query = query.filter({model}.contract_id == contract_id)
        
    if doc_in.cloud_file_id and hasattr({model}, 'cloud_file_id'):
        existing_doc = query.filter({model}.cloud_file_id == doc_in.cloud_file_id).first()
    
    if not existing_doc and doc_in.file_url:
        existing_doc = query.filter({model}.file_url == doc_in.file_url).first()

    if existing_doc:
        existing_doc.name = doc_in.title
        existing_doc.file_url = doc_in.file_url
        existing_doc.file_type = doc_in.file_type
        if hasattr(existing_doc, 'file_size'):
            existing_doc.file_size = doc_in.file_size
        if doc_in.integration_id:
            existing_doc.integration_id = doc_in.integration_id
            
        if hasattr(existing_doc, 'is_linked'):
            existing_doc.is_linked = True
            existing_doc.linked_at = func.now()
            existing_doc.unlinked_at = None
            
        db.commit()
        db.refresh(existing_doc)
        d = existing_doc
        return platform_schemas.Document(
            id=d.id,
            project_id=getattr(d, 'project_id', project_id),
            contract_id=getattr(d, 'contract_id', None),
            title=d.name,
            file_url=d.file_url or "",
            file_type=d.file_type or "unknown",
            department="{name}",
            file_size=getattr(d, 'file_size', 0),
            cloud_file_id=getattr(d, 'cloud_file_id', None),
            origin=d.origin or "file_upload",
            integration_id=d.integration_id,
            is_linked=getattr(d, 'is_linked', True),
            linked_at=getattr(d, 'linked_at', None),
            unlinked_at=getattr(d, 'unlinked_at', None),
            created_at=getattr(d, 'created_at', None)
        )

    kwargs = {{
        "name": doc_in.title,
        "file_url": doc_in.file_url,
        "file_type": doc_in.file_type,
        "origin": doc_in.origin or "file_upload",
        "integration_id": doc_in.integration_id
    }}
    
    if hasattr({model}, 'project_id'):
        kwargs["project_id"] = project_id
    if hasattr({model}, 'contract_id'):
        kwargs["contract_id"] = contract_id
    if hasattr({model}, 'cloud_file_id'):
        kwargs["cloud_file_id"] = doc_in.cloud_file_id
    if hasattr({model}, 'file_size'):
        kwargs["file_size"] = doc_in.file_size
    if hasattr({model}, 'is_linked'):
        kwargs["is_linked"] = True
        kwargs["linked_at"] = func.now()

    new_doc = {model}(**kwargs)
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    d = new_doc
    return platform_schemas.Document(
        id=d.id,
        project_id=getattr(d, 'project_id', project_id),
        contract_id=getattr(d, 'contract_id', None),
        title=d.name,
        file_url=d.file_url or "",
        file_type=d.file_type or "unknown",
        department="{name}",
        file_size=getattr(d, 'file_size', 0),
        cloud_file_id=getattr(d, 'cloud_file_id', None),
        origin=d.origin or "file_upload",
        integration_id=d.integration_id,
        is_linked=getattr(d, 'is_linked', True),
        linked_at=getattr(d, 'linked_at', None),
        unlinked_at=getattr(d, 'unlinked_at', None),
        created_at=getattr(d, 'created_at', None)
    )

@router.delete("/{{document_id}}")
def delete_{name}_document(
    project_id: int,
    document_id: int,
    db: Session = Depends(get_db)
):
    doc = db.query({model}).filter({model}.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if hasattr(doc, 'project_id') and doc.project_id != project_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this project")

    if hasattr(doc, 'is_linked'):
        doc.is_linked = False
        doc.unlinked_at = func.now()
        db.commit()
        db.refresh(doc)
        return {{"status": "unlinked"}}
    else:
        db.delete(doc)
        db.commit()
        return {{"status": "deleted"}}
"""

os.makedirs("app/routes", exist_ok=True)
for r in ROUTERS:
    file_path = f"app/routes/{r['name']}.py"
    with open(file_path, "w") as f:
        f.write(TEMPLATE.format(**r))
    print(f"Created {file_path}")

# Update main.py
main_file = "app/main.py"
with open(main_file, "r") as f:
    content = f.read()

import_lines = "\n".join([f"from .routes import {r['name']}" for r in ROUTERS])
register_lines = "\n".join([f"app.include_router({r['name']}.router, prefix='/api', tags=['{r['tag']}'])" for r in ROUTERS])

if "from .routes import tech" not in content:
    # find where routers are imported
    content = content.replace(
        "from .routes import projects, activities, ai_parser, integrations, users, notes, documents, financials, contracts",
        f"from .routes import projects, activities, ai_parser, integrations, users, notes, documents, financials, contracts\n{import_lines}"
    )
    content = content.replace(
        "app.include_router(documents.router, prefix=\"/api\", tags=[\"Documents\"])", 
        f"app.include_router(documents.router, prefix=\"/api\", tags=[\"Documents\"])\n{register_lines}"
    )
    
    with open(main_file, "w") as f:
        f.write(content)
    print("Updated main.py")
