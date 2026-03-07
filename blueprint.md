# Project Blueprint: Construction Cost and Revenue Analysis

## 1. Introduction

This document outlines the technical blueprint for the Construction Cost and Revenue Analysis platform. The purpose of this application is to provide a streamlined way for construction professionals to analyze Bill of Quantities (BOQ) documents. Users will be able to upload a BOQ file (in `.xls` or `.xlsx` format), and the platform will automatically extract the data, perform cost and revenue analysis, and present a comprehensive report.

## 2. Tech Stack

The platform is built using a modern web stack, featuring a reproducible development environment for local coding and a containerized deployment strategy for production.

- **Frontend:**
  - **Framework:** Next.js (with React)
  - **Language:** TypeScript
  - **Authentication:** Firebase Authentication
  - **Styling:** Tailwind CSS

- **Backend:**
  - **Framework:** FastAPI
  - **Language:** Python
  - **AI Service:** Google Cloud Vertex AI (with a Gemini model)
  - **Caching:** Redis
  - **Core Logic:** A library like `pandas` will be used for parsing Excel files and data manipulation.

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

The application follows a classic client-server architecture.

1.  **Authentication:** The user signs in or registers using **Firebase Authentication** in the **Next.js frontend**.
2.  **File Upload:** The authenticated user selects and uploads a BOQ file.
3.  **Frontend to Backend:** The frontend sends the file directly to the **Python FastAPI backend**, including the user's Firebase ID token in the `Authorization` header for security.
4.  **Backend Processing:**
    - The **FastAPI backend** verifies the Firebase ID token to ensure the request is from an authenticated user.
    - It generates a unique key for the request and checks for a cached result in **Redis**.
    - **If a cached result is found,** it is returned immediately.
    - **If not cached,** the backend uses `pandas` to parse the file and sends the extracted data to a **Gemini model on Google Cloud Vertex AI** for analysis.
    - The new result is stored in **Redis** using the request key before being sent back.
5.  **Response to Frontend:** The analysis is sent back to the Next.js frontend.
6.  **Display Report:** The frontend receives the analysis data and renders a comprehensive report.
