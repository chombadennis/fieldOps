# Cross-Module Data Mapping Implementation Plan

## Overview
This plan outlines the implementation for mapping newly entered Field Operations data to existing documents in other modules (PMO, Engineering, HR, Legal). The goal is to prompt the user to map their Field Operations data immediately after saving, allowing the system to build relational links for future analysis and insights.

## Proposed Changes

### 1. Database Schema
We will create a polymorphic cross-reference table to link Field Operations documents to any other document type in the system.

#### [MODIFY] `backend/app/db/database.py`
- Add a table creation script for `analysis_field_ops_references` to the `run_migrations` function.
  - Columns: `id`, `field_ops_document_id`, `target_document_id`, `target_document_type`, `relationship_mode`, `created_at`.

#### [MODIFY] `backend/app/models/field_ops.py`
- Add a SQLAlchemy model `FieldOpsReference` representing the new table.
- Add a relationship to `FieldOpsDocument` to easily fetch its mapped references.

---

### 2. Backend API

#### [MODIFY] `backend/app/api/endpoints/documents.py` (or equivalent)
- **New Endpoint**: `GET /api/projects/{project_id}/all-mappable-documents`
  - Fetches and aggregates documents from all relevant tables (`documents` for HR/Legal/Engineering, `boq_documents`, `ipc_documents`, `budget_documents`, `activity_schedule_documents`).
  - **Contract Filtering:** Documents will be strictly filtered by `contract_id` if the user is working within a specific contract, or fall back to general project documents if no specific contract is selected.
  - Returns a normalized list grouped by module/type.

*(Note: Based on user feedback, ALL modules are included in this mapping, filtered appropriately by the active contract context.)*
- **New Endpoint**: `POST /api/projects/{project_id}/field-ops/{field_ops_id}/references`
  - Accepts an array of `{ target_document_id, target_document_type }`.
  - Saves the mappings to the `analysis_field_ops_references` table.

---

### 3. Frontend UI

#### [NEW] `frontend/src/components/integrations/CrossModuleMappingModal.tsx`
- A new modal component that appears immediately after a Field Operations document is successfully saved.
- **Features**:
  - Fetches the aggregate list of project documents.
  - Displays them grouped by category (e.g., PMO Modules, HR, Engineering) with checkboxes.
  - "Save Mappings" button to submit the selected relationships to the backend.
  - "Skip / Map Later" button to allow the user to bypass without breaking the flow.

#### [MODIFY] `frontend/src/components/FieldOpsIntegrations.tsx`
- Add state to manage the mapping flow (e.g., `mappingFieldOpsDocId`).
- After `handleManualEntrySave` succeeds, set the `mappingFieldOpsDocId` instead of completely resetting the view.
- Render the `CrossModuleMappingModal` when `mappingFieldOpsDocId` is active.

#### [MODIFY] `frontend/src/components/integrations/ManualEntryModal.tsx`
- Ensure the save hook propagates the successfully created `FieldOpsDocument` ID back to `FieldOpsIntegrations` so it knows which document to map.

## Verification Plan
1. Enter dummy data via Manual Entry in Field Operations.
2. Upon saving, verify the `CrossModuleMappingModal` appears.
3. Select an existing Budget and a Legal document, and save.
4. Verify the database `analysis_field_ops_references` table correctly logs the polymorphic relationships.
5. Ensure clicking "Skip" gracefully closes the flow without errors.
