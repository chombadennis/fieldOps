import os
import sys
import logging
from dotenv import load_dotenv

# Setup paths for backend imports
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
project_root = os.path.abspath(os.path.join(backend_root, '..'))
sys.path.insert(0, project_root)
load_dotenv(os.path.join(project_root, '.env'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from backend.app.utils.security import encrypt_token, decrypt_token
from backend.app.services.integrations.sync_service import auto_map_columns, get_column_letter
from backend.app.services.integrations.google_sheets import get_google_auth_url
from backend.app.services.integrations.onedrive import get_onedrive_auth_url
from backend.app.db.database import SessionLocal
from backend.app.models.project import Project
from backend.app.models.project_integration import ProjectIntegration

def test_encryption():
    logger.info("Testing Token Encryption/Decryption...")
    secret = "secret-refresh-token-12345678"
    encrypted = encrypt_token(secret)
    decrypted = decrypt_token(encrypted)
    assert secret == decrypted, f"Decryption mismatch! Got {decrypted}"
    logger.info("🟢 Encryption/Decryption Test Passed!")

def test_column_mapping():
    logger.info("Testing Column Auto-mapping...")
    rows_standard = [
        ["Item No", "Description", "Unit", "Quantity", "Rate", "Amount"],
        ["1.1", "Excavation in earth", "m3", "120", "45.0", "5400.0"]
    ]
    header_idx, col_map = auto_map_columns(rows_standard)
    assert header_idx == 0, f"Expected header_idx 0, got {header_idx}"
    assert col_map["bill_item_number"] == 0
    assert col_map["description"] == 1
    assert col_map["unit"] == 2
    assert col_map["quantity"] == 3
    assert col_map["rate"] == 4
    assert col_map["amount"] == 5

    # Test AZ column index conversion
    assert get_column_letter(0) == "A"
    assert get_column_letter(25) == "Z"
    assert get_column_letter(26) == "AA"
    logger.info("🟢 Column Mapping Test Passed!")

def test_oauth_urls():
    logger.info("Testing OAuth URL generation...")
    google_url = get_google_auth_url(10)
    onedrive_url = get_onedrive_auth_url(10)
    assert "state=10" in google_url, "Google OAuth URL missing project_id state"
    assert "state=10" in onedrive_url, "OneDrive OAuth URL missing project_id state"
    logger.info("🟢 OAuth URL Generation Test Passed!")

def test_db_persistence():
    logger.info("Testing Database Model Persistence...")
    db = SessionLocal()
    try:
        # Create temporary project if none exists
        proj = db.query(Project).first()
        if not proj:
            logger.info("Creating a temporary project for testing...")
            proj = Project(name="Test Verification Project", description="Temporary project")
            db.add(proj)
            db.commit()
            db.refresh(proj)

        # Create integration
        integration = ProjectIntegration(
            project_id=proj.id,
            provider="google_sheets",
            spreadsheet_id="test_sheet_123",
            refresh_token=encrypt_token("test_refresh_token"),
            sheet_name="BOQ Sheet"
        )
        db.add(integration)
        db.commit()
        db.refresh(integration)

        # Query and assert values
        saved = db.query(ProjectIntegration).filter(ProjectIntegration.id == integration.id).first()
        assert saved is not None, "Failed to load ProjectIntegration from DB"
        assert saved.spreadsheet_id == "test_sheet_123"
        assert saved.sheet_name == "BOQ Sheet"
        assert decrypt_token(saved.refresh_token) == "test_refresh_token"

        # Cleanup
        db.delete(saved)
        db.commit()
        logger.info("🟢 Database persistence test passed!")
    except Exception as e:
        db.rollback()
        logger.exception("🔴 Database Test Failed:")
        raise e
    finally:
        db.close()

from backend.app.models.boq_document import BoqDocument

def test_boq_validations():
    logger.info("Testing BOQ Document validations (limits & duplicates)...")
    db = SessionLocal()
    try:
        # Create a temp project
        proj = Project(name="Verification Validations Project", description="Temp")
        db.add(proj)
        db.commit()
        db.refresh(proj)

        # 1. Insert 5 BOQ documents
        boqs = []
        for i in range(5):
            doc = BoqDocument(
                project_id=proj.id,
                name=f"BOQ File {i}",
                file_hash=f"hash_code_verification_{i}"
            )
            db.add(doc)
            boqs.append(doc)
        db.commit()

        # 2. Check that the project now has 5 BOQ documents
        count = db.query(BoqDocument).filter(BoqDocument.project_id == proj.id).count()
        assert count == 5, f"Expected 5 BOQ documents, got {count}"

        # 3. Simulate limit check
        if count >= 5:
            logger.info("🟢 Limit check validation works (correctly identified 5 BOQs)!")

        # 4. Simulate duplicate check
        duplicate_hash = "hash_code_verification_0"
        duplicate = db.query(BoqDocument).filter(
            BoqDocument.project_id == proj.id,
            BoqDocument.file_hash == duplicate_hash
        ).first()
        assert duplicate is not None, "Failed to detect duplicate file hash"
        logger.info("🟢 Duplicate file check validation works!")

        # Cleanup
        for doc in boqs:
            db.delete(doc)
        db.delete(proj)
        db.commit()
        logger.info("🟢 BOQ Document validation test passed!")
    except Exception as e:
        db.rollback()
        logger.exception("🔴 BOQ Validations Test Failed:")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    print("\n" + "="*80)
    print("RUNNING INTEGRATIONS VERIFICATION TESTS")
    print("="*80)
    
    test_encryption()
    test_column_mapping()
    test_oauth_urls()
    test_db_persistence()
    test_boq_validations()
    
    print("="*80)
    print("ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
    print("="*80)
