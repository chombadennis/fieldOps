# FieldOps: Construction Cost and Revenue Analysis

FieldOps is a web-based platform designed to streamline the analysis of Bill of Quantities (BOQ) documents for construction professionals. By leveraging AI, the application automates the process of data extraction, cost and revenue analysis, and report generation, enabling users to make faster and more informed decisions.

## Key Features

*   **Effortless BOQ Upload:** Upload your BOQ files in `.xls` or `.xlsx` format.
*   **AI-Powered Analysis:** Our platform uses Google's Gemini AI model to automatically parse and analyze your documents.
*   **Comprehensive Reporting:** Receive detailed reports on cost and revenue, presented in a clear and understandable format.
*   **Secure Authentication:** User authentication is handled securely via Firebase.

## Tech Stack

The platform is built with a modern and robust technology stack:

*   **Frontend:**
    *   Framework: [Next.js](https://nextjs.org/) (React)
    *   Language: [TypeScript](https://www.typescriptlang.org/)
    *   Styling: [Tailwind CSS](https://tailwindcss.com/)
    *   Authentication: [Firebase Authentication](https://firebase.google.com/docs/auth)
*   **Backend:**
    *   Framework: [FastAPI](https://fastapi.tiangolo.com/)
    *   Language: [Python](https://www.python.org/)
    *   AI Service: [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai) (Gemini)
*   **Development Environment:**
    *   The entire development environment is managed by [Nix](https://nixos.org/) for consistency and reproducibility.

## Project Structure

This project is organized as a monorepo to simplify development and dependency management.

```
/
├── frontend/         # Next.js application
├── backend/          # FastAPI application
├── scripts/          # Additional scripts
└── ...
```

## Getting Started

This project uses Nix to provide a consistent and reproducible development environment. All other dependencies, including Python, Node.js, and Redis, are managed automatically.

### 1. Initial Setup (First-Time Contributors)

If you don't have Nix installed, you must install it first. It's a one-time setup.

*   **On macOS or Linux:** Run the official installer from your terminal:
    ```bash
    sh <(curl -L https://nixos.org/nix/install) --daemon
    ```
    Follow the on-screen instructions.
*   **On Windows:** It is recommended to use the [Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install) and then follow the Linux instructions above inside your WSL terminal.

### 2. Clone the Repository

```bash
# Replace with the actual URL of your repository
git clone https://github.com/your-username/fieldops.git
cd fieldops
```

### 3. Enter the Development Environment

This project is configured to work with Nix-aware tools like Project IDX or by using the `nix-shell` command.

*   **In Project IDX:** The environment is activated automatically when you open the workspace. The Redis server is also started for you.
*   **In a local terminal:** Navigate to the project root and run:
    ```bash
    nix-shell
    ```

This command reads the `.idx/dev.nix` file and gives you a shell with all the tools (Python, Node, Redis) ready to go. You may need to start the Redis server manually by running `redis-server --daemonize yes`.

### 4. Configure Environment Variables

The backend requires API keys and other secrets. You need to create a `.env` file for local development.

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a new file named `.env`.
3.  Copy the contents of `backend/.env.example` into your new `.env` file and fill in your secret API keys and database credentials.

### 5. Database Setup

Before running the application for the first time, you need to create the database tables. This project uses a script to initialize the database based on the SQLAlchemy models.

From the root of the project, run the following command:

```bash
python scripts/init_db.py
```

This will create all the necessary tables in your database.

### 6. Running the Development Environment

Once your environment and database are set up, you can run the application servers. These commands should be run from the root of the project.

#### Backend

In your terminal, run the following commands:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

This will start the FastAPI server on `http://localhost:8000`. You should leave this terminal running.

#### Frontend

Open a **new terminal window**. In the new terminal, run the following commands from the project root:

```bash
cd frontend
npm install
npm run dev
```

This will start the Next.js development server on `http://localhost:3000`.
