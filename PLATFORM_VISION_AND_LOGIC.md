# FieldOps Platform Vision and Extraction Architecture

## Why Different Extraction Logics Are Necessary

In the context of construction and large-scale project management, applying a "one-size-fits-all" extraction logic to documents would result in massive financial errors, double-counting, or critical missing data. Each module demands its own distinct architecture:

### 1. Activity Schedule (The ETL Pipeline)
Activity Schedules are fundamentally **flat, row-based lists** that can run for hundreds of lines. However, no two contractors format them exactly the same way. One might include columns for "Start Date" and "End Date," while another uses "Duration" and "Dependencies." 
*   **The Logic:** If the system only hardcoded specific fields to extract, you would lose all that extra context. By acting as an ETL (Extract, Transform, Load) pipeline, it sweeps up *every* unpredictable column into a dynamic JSON object (`values_map`) while securing the core metrics (price and weight). This guarantees zero data loss regardless of how the contractor formatted their spreadsheet.

### 2. Budget & EVM (The Consolidation Engine)
On large projects, the budget is rarely a single, clean document. Instead, it’s a chaotic mix of workbooks from different subcontractors (Electrical, Plumbing, Civil) that roll up into a Master Contractor's cover sheet.
*   **The Logic:** If the system just extracted everything row-by-row, it would suffer from massive **double-counting**. For example, it might extract the $500k "Electrical Summary" from the master sheet, and then extract the $500k total from the electrician's individual workbook, doubling the budget to $1M. The consolidation engine is necessary to actively hunt for these overlaps and deduplicate them, ensuring Earned Value calculations remain mathematically sound.

### 3. IPC (The Multi-Sheet Semantic Parser)
Interim Payment Certificates (IPCs) are rigid, legally binding financial documents that dictate cash flow. They are almost never flat lists; they are mathematically layered across multiple tabs (e.g., Tab 1: Cover Sheet, Tab 2: Advance Deductions, Tab 3: BoQ Breakdown). 
*   **The Logic:** A standard extractor would look at an IPC and get completely confused between a row meant to represent "Retention Withheld" and a row meant to represent "Concrete Poured." Furthermore, different Quantity Surveyors use different terminology (e.g., "WHT", "Withholding Tax", "Less 3% Tax"). The semantic parser uses a hardcoded library of aliases to surgically hunt for these exact financial triggers across different tabs, ensuring that taxes, retentions, and the final "Net Payment Due" are flawlessly accurate.

**In short:** You can't parse a legal tax document (IPC) the same way you parse a schedule of tasks (Activity Schedule), nor can you parse a single contractor's list the same way you reconcile a master project budget. The different engines exist to mirror the specialized accounting rules required for each scenario.

---

## The Ultimate Goal: Beyond Data Extraction

The essence of all this extraction is to build what the construction industry calls the **"Golden Thread"** of project data. Data extraction is only Step 1. If it stopped there, this would just be an expensive OCR tool. 

The ultimate goal of this platform is to **cross-examine and reconcile** that data across different departments (PMO, Engineering, Field Ops, Finance) to automate auditing, prevent overbilling, and provide real-time project health.

Here is what happens *after* the data is extracted and how it is actually used:

### 1. Automated Substantiation (The Cross-Check)
Right now, a Quantity Surveyor or Project Manager has to manually check a contractor's payment claim (IPC) against the baseline budget and the physical work done on-site. The platform automates this. 
*   **Example:** A contractor submits a Milestone Claim stating they have completed 60% of the Steel Framing, requesting $500k. Because the system has already extracted the Master Budget, it knows the total allocated for Steel Framing is only $700k. Furthermore, because it tracks Field Operations, it can check the "Material Delivery Logs" to see if 60% of the steel tonnage has even arrived on site. If the physical logs don't match the financial claim, the system instantly flags it before anyone signs a check.

### 2. Dynamic Contract Enforcement
Construction contracts are highly specific (Lump Sum, Unit Price, Cost Plus). Because the data is now structured in the database, the system enforces the rules of the contract automatically:
*   If it's a **Unit Price** contract, the system demands measured physical quantities from the field ops tab before allowing an IPC to be approved.
*   If it's a **Cost-Plus** contract, the system checks the Reimbursable Costs tab for scanned receipts and timesheets to justify the budget burn.

### 3. Real-Time Cost & Revenue Analytics
Instead of waiting for a month-end report, the platform uses the extracted data to power live dashboards. Because the budget items (`original_contract_sum`, `earned_value`) and schedule activities (`weight_percentage`) are sitting in native database rows, the platform instantly calculates:
*   **Earned Value Management (EVM)** metrics.
*   **Cost Performance Index (CPI)** to tell you if you are bleeding money.
*   **Schedule Performance Index (SPI)** to tell you if you are behind the timeline.

### 4. Cloud Synchronization
Because the system links directly to the underlying Google Sheets or OneDrive files, it acts as a live monitor. If a contractor silently goes into their shared Google Sheet and alters a unit rate or an approved BoQ quantity, the platform detects the change, re-runs the AI engine, and alerts the PMO that the baseline data has been tampered with.

**The Bottom Line:** The extraction engines do the heavy lifting of turning messy, unstructured contractor spreadsheets and PDFs into clean, structured database rows. Once it's in the database, the platform transforms from a file storage system into an **automated project auditor**, linking physical field progress directly to financial payouts.
