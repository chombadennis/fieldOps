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

## The Ultimate Goal: A Centralized System of Record

The essence of all this extraction is to build what the construction industry calls the **"Golden Thread"** of project data. Data extraction is only Step 1. If it stopped there, this would just be an expensive OCR tool. 

The ultimate goal of this platform is to act as a **Centralized Command Center** that brings disintegrated data from local computers and the cloud into one unified narrative. It is designed to give senior leadership total visibility through the chaos, foster seamless collaboration between teams, and build a lasting historical footprint.

Here is what happens *after* the data is extracted and how it transforms project execution:

### 1. Centralize the Chaos
Construction projects are notorious for having documents scattered across local drives, email attachments, and various cloud folders. FieldOps pulls these disparate summaries and overviews into a single hub. This ensures that everyone from the site engineer to senior leadership is looking at the exact same data.

### 2. Seamless Collaboration & Issue Resolution
Instead of disconnected email chains, FieldOps provides built-in tools for teams to collaborate directly on the data. Users can chat with team members, leave notes, log issues, manage escalations, and track follow-ups. Role-based access ensures that sensitive data is only visible to the right people while maintaining transparency where it matters.

### 3. Build a Historical Footprint
Construction companies often lose invaluable knowledge when a project ends or when key personnel leave. FieldOps records where a project started, where it stands, what was discussed and agreed upon, and how it concluded. This allows companies to learn from both past mistakes and past successes by reinforcing the team's experience with project data. 

### 4. Effortless Onboarding
Because the entire history of the project is documented in one place, bringing a new team member up to speed is no longer a manual chore. A new hire can instantly review the project's historical footprint, understand how the company has been handling operations, and immediately see where they can add value.

**The Bottom Line:** FieldOps is not just a file storage system. It is a living, breathing workspace that brings disintegrated teams together, providing total clarity for leadership and a permanent historical record for the future.
