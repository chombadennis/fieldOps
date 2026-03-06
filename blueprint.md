# Project Blueprint: Construction Cost and Revenue Analysis

## 1. Introduction

This document outlines the technical blueprint for the Construction Cost and Revenue Analysis platform. The purpose of this application is to provide a streamlined way for construction professionals to analyze Bill of Quantities (BOQ) documents. Users will be able to upload a BOQ file (in `.xls` or `.xlsx` format), and the platform will automatically extract the data, perform cost and revenue analysis, and present a comprehensive report.

## 2. Tech Stack

The platform is built using a modern web stack, containerized within a reproducible development environment.

- **Frontend:**
  - **Framework:** Next.js (with React)
  - **Language:** TypeScript
  - **Authentication:** Firebase Authentication
  - **Styling:** Tailwind CSS
  - **API Communication:** Next.js API Routes acting as a proxy.

- **Backend:**
  - **Framework:** FastAPI
  - **Language:** Python
  - **AI Service:** Google Cloud Vertex AI (with a Gemini model)
  - **Core Logic:** A library like `pandas` will be used for parsing Excel files and data manipulation before sending it to the AI.

- **Development Environment:**
  - **Manager:** Nix
  - **Configuration:** A single `.idx/dev.nix` file will define all packages, dependencies, and environment variables for both the frontend and backend, ensuring a consistent and reproducible setup.

## 3. Project Structure

The project is organized as a monorepo to simplify development and management.

```
/
├── .idx/
│   └── dev.nix       # Single source of truth for the development environment
├── frontend/         # Next.js application
│   ├── src/
│   │   └── app/
│   │       ├── api/        # API routes (proxy to the backend)
│   │       ├── components/ # React components
│   │       └── page.tsx    # Main application page
│   ├── package.json
│   └── ...
├── backend/          # FastAPI application
│   ├── main.py       # Main FastAPI application file
│   └── requirements.txt
└── blueprint.md      # This file
```

## 4. Architecture and Data Flow

The application follows a classic client-server architecture, with a key modification in the communication flow to enhance security and simplify development.

1.  **Authentication:** The user signs in or registers using **Firebase Authentication** in the **Next.js frontend**.
2.  **File Upload:** The authenticated user selects a BOQ file in the frontend.
3.  **Frontend to Proxy:** The frontend sends the file along with the user's ID token to a **Next.js API route** (e.g., `/api/upload`).
4.  **Proxy to Backend:** The Next.js API route forwards the request to the **Python FastAPI backend**. The ID token is passed in the `Authorization` header.
5.  **Backend Authentication & Processing:**
    - The **FastAPI backend** verifies the Firebase ID token to ensure the request is from an authenticated user.
    - It uses `pandas` to parse the uploaded Excel file.
    - It then sends the extracted data to a **Gemini model on Google Cloud Vertex AI** for analysis.
6.  **Response to Frontend:** The analysis from Vertex AI is received by the backend, which then sends the result back through the same chain: FastAPI -> Next.js API Route -> Next.js Frontend.
7.  **Display Report:** The frontend receives the analysis data and renders a comprehensive report.
