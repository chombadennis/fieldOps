# Project Blueprint: FieldOps Collaboration Platform

## 1. Introduction

This document outlines the technical blueprint for the FieldOps platform. The platform serves as a collaboration hub for construction companies to manage projects, PMO financials (BoQs, Budgets, IPCs), and departmental communication. Users can manage project financial controls through the PMO module—uploading BoQ files for automated extraction, parsing cloud documents, managing budgets, and issuing IPCs—as well as collaborating contextually through linked documents and notes within specific departmental modules (Engineering/Tech, Field Operations, HR, Legal).

## 2. Tech Stack

The platform is built using a modern web stack, featuring a reproducible development environment for local coding and a containerized deployment strategy for production.

- **Frontend:**
  - **Framework:** Next.js (with React)
  - **Language:** TypeScript
  - **Authentication:** Firebase Authentication (Client SDK for user login)
  - **Styling:** Tailwind CSS

- **Backend:**
  - **Framework:** FastAPI
  - **Language:** Python
  - **Database:** PostgreSQL (via SQLAlchemy)
  - **Authentication:** Firebase Admin SDK (for token verification and authorization)
  - **AI Service:** Google Cloud Vertex AI (with a Gemini model)
  - **Caching:** Redis
  - **Core Logic:** `pandas` for parsing Excel files, with custom logic for Role-Based Access (RBA) and project hierarchy.

- **Development Environment:**
  - **Manager:** Nix
  - **Configuration:** A single `.idx/dev.nix` file defines all packages (Python, Node.js, Redis), ensuring a consistent local setup for all developers.

- **Deployment:**
  - **Containerization:** Docker
  - **Strategy:** The backend will be packaged into a Docker container for portable, scalable deployment on hosting services like Render, Google Cloud Run, or AWS Fargate.

## 3. Project Structure

The project is organized as a monorepo to simplify development and management.

```
/
├── .idx/
│   └── dev.nix       # Source of truth for the development environment
├── frontend/         # Next.js application
│   └── ...
├── backend/          # FastAPI application
│   ├── app/          # Core application logic
│   ├── Dockerfile    # Instructions to containerize the backend for production
│   └── requirements.txt
└── blueprint.md      # This file
```

## 4. Architecture and Data Flow

The application follows a client-server architecture centered around Company Accounts and Projects.

1.  **Authentication & Context:** The user signs in using **Firebase Authentication** in the **Next.js frontend**. The backend verifies the token using the Firebase Admin SDK and assigns the user their Company and Role.
2.  **Project Navigation:** The user navigates to a specific Project workspace and selects between the **PMO (Project Management Office)** module and dedicated departmental sections.
3.  **Role-Based Access (RBA):** The frontend sends requests to the **FastAPI backend** with the Firebase ID token. The backend verifies the token and enforces RBA to ensure the user is authorized for that module.
4.  **Backend Processing:**
    - For BoQ processing, it generates a unique key and checks for a cached result in **Redis**.
    - **If not cached,** the backend uses `pandas` to parse the file and sends the extracted data to a **Gemini model on Google Cloud Vertex AI** for analysis. The result is cached in Redis.
    - For notes, documents, IPCs, and budgets, the backend updates the database and returns the current state.
5.  **Response to Frontend:** The processed data or collaboration updates are sent back to the Next.js frontend.
6.  **Display Data:** The frontend receives the data and renders the contextual project view or financial analysis cleanly.

## 5. Platform Modules & Collaboration Flow

The system organizes data hierarchically, allowing targeted, role-specific collaboration without the overhead of heavy project management software.

### 1. Hierarchy & Modules
A Company serves as the primary tenant, containing multiple **Projects**. Each Project acts as a central workspace organized into top-level sections:

*   **PMO (Project Management Office):** Houses financial, cloud document, and claims management in a unified control panel with a vertical grid/sidebar navigation on the left to toggle between:
    - **BoQ & Files:** Bill of Quantities spreadsheet upload, automated parsing/breakdown, cloud integrations (Google Drive & OneDrive), linked workbooks, and report generation.
    - **IPC & Claims:** Interim Payment Certificate generation, progress payment tracking, amount claimed vs. certified, and certification workflow.
    - **Budget:** Financial allocations, cost category tracking (Materials, Labor, Equipment, Legal/Permits, Subcontractors, Contingency).
*   **Departmental Sections:** Dedicated operational & compliance modules for cross-functional teams:
    - **Engineering / Tech:** Technical specifications, structural logs, calculations, and engineering issue logs.
    - **Field Operations:** Site logs, weather delays, safety updates, equipment tracking, and contractor coordination.
    - **HR (Human Resources):** Site staffing rosters, labor compliance, personnel onboarding, and labor issues.
    - **Legal & Compliance:** Subcontractor contracts, environmental permits, regulatory compliance, and legal notices.

### 2. Collaboration Engine
*   **Notes & Issues:** Users can log contextual notes, flag issues, and set follow-ups within any specific module or directly tied to a document (e.g., a note on a specific BoQ item).
*   **Document Linking:** Documents (contracts, compliance forms, site photos) are uploaded and linked directly to relevant notes or sections, rather than residing in a generic file dump.
*   **Messaging & Notifications:** A notification and messaging system keeps team members aligned through mentions and real-time updates within the project context.

