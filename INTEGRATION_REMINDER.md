# Integration Reminder: Dynamic Reference Tracking for Analysis & Payments

Use this document as a guide when refining the UI and analysis pipelines for **Milestone Payments**, **IPCs**, and **Cost Analysis** to connect the selected contract documents (Activity Schedules vs. BoQs).

---

## 1. Schema Specifications

We have created two persistent reference tracking tables in PostgreSQL:

### A. Lump Sum Contracts (Activity Schedules)
* **Table Name**: `analysis_schedule_references`
* **Python Model**: `AnalysisScheduleReference` in [activity_schedule.py](file:///e:/MyProjects/fieldOps/backend/app/models/activity_schedule.py)
* **Target Schema**:
  * `id` (int, Primary Key)
  * `reference_source_id` (int) - The ID of the claiming document (e.g. `PaymentClaim.id`, `CostReport.id`)
  * `reference_source_type` (str) - Name of transaction type (e.g. `'PAYMENT_CLAIM'`, `'COST_VALUATION'`)
  * `activity_schedule_document_id` (int, FK $\rightarrow$ `activity_schedule_documents.id`)
  * `relationship_mode` (str) - Choice of `'AGGREGATE'`, `'COMPARE'`, or `'INDEPENDENT'`

### B. Unit Price Contracts (Bills of Quantities)
* **Table Name**: `analysis_boq_references`
* **Python Model**: `AnalysisBoqReference` in [boq_document.py](file:///e:/MyProjects/fieldOps/backend/app/models/boq_document.py)
* **Target Schema**:
  * `id` (int, Primary Key)
  * `reference_source_id` (int) - The ID of the transaction/claim
  * `reference_source_type` (str) - Name of transaction type (e.g. `'IPC_CLAIM'`, `'COST_VALUATION'`)
  * `boq_document_id` (int, FK $\rightarrow$ `boq_documents.id`)
  * `relationship_mode` (str) - Choice of `'AGGREGATE'`, `'COMPARE'`, or `'INDEPENDENT'`

---

## 2. To-Do During UI & Analysis Refinements

When building the frontend forms and backend validation endpoints for claims or reports:

### 1. Milestone Payments (Lump Sum)
* **UI**: Present a multi-select checkbox list of linked Activity Schedule documents.
* **Selection Mode**: Let the user define the mode (`AGGREGATE` if combining baselines and variations, or `INDEPENDENT` for separate trade packages).
* **Save Step**: On submit, save these choices as rows in `analysis_schedule_references` with `reference_source_type = 'PAYMENT_CLAIM'`.

### 2. IPC Refinements (Unit Price)
* **UI**: Present a multi-select checkbox list of linked BoQ documents.
* **Save Step**: On submit, save these choices as rows in `analysis_boq_references` with `reference_source_type = 'IPC_CLAIM'`.

### 3. Cost Analysis Reports (Unified Dashboard)
* **Aggregation**: If `AGGREGATE` mode is selected:
  * Sum up all fixed prices or item values: $\text{Consolidated Value} = \sum \text{Documents}$.
* **Independent**: If `INDEPENDENT` mode is selected:
  * Keep the scopes separate (e.g. *Electrical* vs. *Steel*). Do not merge weight percentages, but display their progress values side-by-side.
* **Compare**: If `COMPARE` mode is selected:
  * Pair matching `activity_id` codes to show budget slips and variances.
