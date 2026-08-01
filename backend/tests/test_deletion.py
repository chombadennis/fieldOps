import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None):
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        return e.code, json.loads(content) if content else {}

def test_document_deletion_flow():
    print("==============================================================")
    print(" STARTING DOCUMENT UNLINKING & PERMANENT DELETION TEST SUITE ")
    print("==============================================================")

    # Step 1: Get Project
    print("\n1. Fetching Project...")
    status, projects = make_request(f"{BASE_URL}/projects")
    assert status == 200, f"Failed to list projects: {projects}"
    if not projects:
        print("No projects found, creating dummy project...")
        status, new_proj = make_request(f"{BASE_URL}/projects", method="POST", data={"name": "Test Deletion Project"})
        assert status == 200
        project_id = new_proj["id"]
    else:
        project_id = projects[0]["id"]
    print(f"[OK] Using Project ID: {project_id}")

    # Step 2: Test General Documents (/projects/{project_id}/documents)
    print("\n2. Testing General Documents (documents.py)...")
    status, gen_doc = make_request(
        f"{BASE_URL}/projects/{project_id}/documents",
        method="POST",
        data={
            "title": "Test Structural Report.pdf",
            "file_url": "https://drive.google.com/file/d/test_structural_report",
            "file_type": "PDF",
            "department": "All"
        }
    )
    assert status == 200, f"Failed to create document: {gen_doc}"
    gen_doc_id = gen_doc["id"]
    print(f"  [+] Created Document ID {gen_doc_id}: '{gen_doc['title']}' (is_linked={gen_doc.get('is_linked')})")

    # Step 2a: Unlink
    status, unlinked_doc = make_request(f"{BASE_URL}/projects/{project_id}/documents/{gen_doc_id}/unlink", method="POST")
    assert status == 200, f"Failed to unlink document: {unlinked_doc}"
    assert unlinked_doc.get("is_linked") is False, "Expected is_linked to be False"
    print(f"  [OK] Unlinked Document ID {gen_doc_id}: is_linked={unlinked_doc.get('is_linked')}")

    # Step 2b: Permanent Delete
    status, del_resp = make_request(f"{BASE_URL}/projects/{project_id}/documents/{gen_doc_id}", method="DELETE")
    assert status == 200, f"Failed to delete document: {del_resp}"
    print(f"  [OK] Permanently Deleted Document ID {gen_doc_id} from database")

    # Verify document is gone from active list
    status, doc_list = make_request(f"{BASE_URL}/projects/{project_id}/documents")
    assert status == 200
    ids = [d["id"] for d in doc_list]
    assert gen_doc_id not in ids, f"Document ID {gen_doc_id} should be purged from database"
    print(f"  [OK] Verified Document ID {gen_doc_id} no longer exists in database records")

    # Step 3: Test Decoupled Modules (IPC, Tech/Engineering, Field Ops, Budgets, Program of Works, etc.)
    modules = [
        ("ipc", "IPC Payment Certificate.xlsx"),
        ("tech", "Structural Specification.dwg"),
        ("field_ops", "Daily Site Log.xlsx"),
        ("budget", "Master Project Budget.xlsx"),
        ("program_of_works", "Master Program of Works.xlsx"),
        ("activity_schedule", "Site Activity Schedule.xlsx"),
        ("milestone_claims", "Milestone Claim Sheet.xlsx"),
        ("rate_schedule", "Schedule of Rates.xlsx"),
        ("reimbursable_claims", "Reimbursable Claims Log.xlsx")
    ]

    print("\n3. Testing Decoupled Modules (IPC, Tech, Field Ops, Budgets, Program of Works, etc.)...")
    for mod_endpoint, doc_title in modules:
        print(f"\n--- Testing Module: '{mod_endpoint}' ---")
        # Create
        status, doc = make_request(
            f"{BASE_URL}/projects/{project_id}/{mod_endpoint}",
            method="POST",
            data={
                "title": doc_title,
                "file_url": f"https://drive.google.com/file/d/test_{mod_endpoint}",
                "file_type": "Spreadsheet"
            }
        )
        assert status == 200, f"Failed to create {mod_endpoint} document: {doc}"
        doc_id = doc["id"]
        print(f"  [+] Created {mod_endpoint.upper()} Document ID {doc_id}: '{doc['title']}'")

        # Unlink
        status, unlink_res = make_request(f"{BASE_URL}/projects/{project_id}/{mod_endpoint}/{doc_id}/unlink", method="POST")
        assert status == 200, f"Failed to unlink {mod_endpoint} document: {unlink_res}"
        print(f"  [OK] Unlinked {mod_endpoint.upper()} Document ID {doc_id}")

        # Permanent Delete
        status, del_res = make_request(f"{BASE_URL}/projects/{project_id}/{mod_endpoint}/{doc_id}", method="DELETE")
        assert status == 200, f"Failed to delete {mod_endpoint} document: {del_res}"
        print(f"  [OK] Permanently Deleted {mod_endpoint.upper()} Document ID {doc_id} from database")

        # Verify document is gone from module document list
        status, mod_docs = make_request(f"{BASE_URL}/projects/{project_id}/{mod_endpoint}")
        assert status == 200
        mod_ids = [d["id"] for d in mod_docs]
        assert doc_id not in mod_ids, f"Document ID {doc_id} should be purged from {mod_endpoint} database records"
        print(f"  [OK] Verified {mod_endpoint.upper()} Document ID {doc_id} no longer exists in database")

    print("\n==============================================================")
    print(" ALL DELETION & UNLINKING VERIFICATIONS PASSED 100% SUCCESS ")
    print("==============================================================")

if __name__ == "__main__":
    test_document_deletion_flow()
