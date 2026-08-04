# Milestone Payments & Field Operations Integration Roadmap

Use this guide as a spec sheet and checklist for building out the frontend integration UI, backend endpoints, validation schemas, and database synchronization logic for the **Milestone Payments** and **Field Operations** modules.

---

## 1. Milestone Payments Tab Upgrades
Transition the Milestone Payments tab to follow our standard integration flow:

### A. Document Upload & Link Flow
* **File Formats**: Permit PDF and Word (`.doc`, `.docx`) for formal payment claims/certificates.
* **Cloud Integration**: Support connecting Google Sheets / OneDrive spreadsheets for structured milestone schedules.

### B. Backend Endpoints & Heuristics
* **Validation Endpoint** (`POST /projects/{project_id}/milestone_payments/validate`):
  * Scans metadata of uploaded claims.
  * Checks for WBS codes matching the approved Activity Schedule.
* **Preview Endpoint / AI Parser** (`POST /projects/{project_id}/milestone_payments/preview`):
  * Extracts list of milestones, claimed percentages, and values.
* **Commit Endpoint** (`POST /projects/{project_id}/milestone_payments/commit`):
  * Saves finalized claims to database under `milestone_claims` and `milestone_claim_items`.
  * Computes gross valuations, subtracts previous claims, applies retention deductions, and calculates net amounts payable.

### C. Human-in-the-Loop Preview Modal
* **UI**: Show side-by-side comparison tables before committing:
  * **Activity Baseline Value** vs. **Claimed Percentage** vs. **Gross Earned Value**.
  * Flag discrepancies (e.g., cumulative claims exceeding 100%).

---

## 2. Field Operations Tab Dynamic Contract-Type Integration
The **Field Operations** tab must adapt dynamically depending on the project's **Active Contract Type**:

### A. Feature Activation Matrix
* **For Unit Price (`UNIT_PRICE`)**:
  * Activate: **Physical Progress Checklists** & **Measured Quantities Log**.
  * Input: Quantity installed of each item (e.g. cubic meters, linear meters) linked to `BoqItem.id`.
* **For Lump Sum (`LUMP_SUM`)**:
  * Activate: **Material Delivery Audits** & **BOM Tracking** (Roof Truss BOM, proposed substitution delta).
  * Input: Total weight needed vs. total weight delivered to site or workshop (MS Plates, sections, angles, rods) linked to `ActivityScheduleItem.id`.
* **For Cost Plus (`COST_PLUS`)**:
  * Activate: **Labor Timesheets** & **Equipment Logs**.
  * Input: Hours worked, resource rates, and receipt scans.
* **For General / Master (`GENERAL`)**:
  * Activate: **All logs** (checklists, material weights, daily timesheets).

### B. Data & Analysis Mapping Logic
* **Dynamic Columns (JSONB)**: Use the `values_map` column in field operations models to store custom structural metadata (e.g., steel thickness, PO reference, delivery notes).
* **AI Substantiation Logic (To Be Mapped Later)**:
  * Build audit reconciliation logic comparing physical progress metrics against contractor invoice claims (e.g., if contractor claims 60% completion of steel framing, the system checks if at least 60% of material weights have been delivered/erected based on the Material Delivery Audit logs).
