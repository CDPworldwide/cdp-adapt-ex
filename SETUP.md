# Setup & Installation Guide

This guide will help you set up the CDP Adaptation & Action Explorer project locally.

## 📋 Table of Contents
- [Prerequisites](#-prerequisites)
- [Quick Start (Recommended)](#-quick-start-recommended)
- [Manual Setup](#-manual-setup)
  - [1. Database Setup](#1-database-setup)
  - [2. Backend Setup](#2-backend-setup)
  - [3. API Client Generation](#3-api-client-generation)
  - [4. Frontend Setup](#4-frontend-setup)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)

---

## 📋 Before you start

Ensure you have the following installed on your system:

### Core Requirements
- **Python 3.13+**: [Download](https://www.python.org/downloads/)
- **uv**: Python package manager. [Download](https://docs.astral.sh/uv/getting-started/installation/)
- **Node.js v20+**: [Download](https://nodejs.org/)
- **PostgreSQL**: [Download](https://www.postgresql.org/download/)
- **Google Cloud SDK**: [Download](https://cloud.google.com/sdk/docs/install) (required if you want a working "Ask CDP" chat functionality -- uses Gemini integration.)
- **Make**: Build automation tool (usually pre-installed on Linux/macOS).

### System Dependencies (Linux/Debian)
```bash
sudo apt install graphviz-dev libgraphviz-dev libpq-dev
```

## 🚀 Quick Start (Recommended)

The project includes a `Makefile` to automate the setup process. Run `make help` to see all available commands.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/CDPworldwide/pac-api.git
   cd pac-api
   ```

2. **Initialize all components**:
   ```bash
   make install          # Install all dependencies (backend + client + frontend)
   make setup-hooks      # Install pre-commit hooks for automated linting
   ```

3. **Create the database**:
   Refer to the [Data Integration & Setup Guide](docs/data.md) for instructions on downloading the data archive, defining the schema, and importing the CSV files into your database.

4. **Configure environments**:
   Follow the [Environment Variables](#-environment-variables) section to set up your `.env` and environment files.

5. **Run the application**:
   Open two terminal sessions and run:
   ```bash
   make run-backend     # Terminal 1
   make run-frontend    # Terminal 2
   ```

### Common Makefile Commands

Run these commands from the project root:

| Command | Description |
|---------|-------------|
| `make install` | Install all backend + frontend dependencies |
| `make run-backend` | Start backend server locally (with default port 8000)|
| `make run-frontend` | Start frontend server (with default port 4200)|
| `make test` | Run all tests |
| `make lint` | Run linting checks |
| `make lint-fix` | Auto-fix linting issues |
| `make clean` | Clean build artifacts |


## 🛠 Manual Setup

If you prefer to set up each component manually, follow these steps:

### 1. Database Setup
   Please follow the detailed [Data Integration & Setup Guide](docs/data.md) to set up either a local PostgreSQL database or a Cloud SQL instance and import the required CDP datasets.

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
1. Install dependencies:
   ```bash
   uv sync
   ```
1. Initialize environment variables (See [Environment Variables](#-environment-variables)).
1. Ensure that the database is running on the correct port. (TODO: add instructions)
1. Run the backend server:
   - **Using Makefile**: `make run-backend`
   - **Manual (for custom port)**:
     ```bash
     uv run fastapi dev app/main.py --port 8000
     ```

### 3. API Client Generation
The frontend uses an auto-generated TypeScript client which acts as a bridge between frontend and backend.

**Using Makefile:**
```bash
make install-client
```

**Manual setup:**
```bash
cd client
npm install
npm run generate
npm run build
```

### 4. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
1. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize environment variables (See [Environment Variables](#-environment-variables)).
1. Make sure backend is running.
1. Run the frontend server:
   - **Using Makefile**: `make run-frontend`
   - **Manual (for custom port)**:
     ```bash
     npm start -- --port 4200
     ```
   The application will be available at `http://localhost:4200`.

## 🔑 Environment Variables

### Backend (`backend/.env`)
Initialize the environment file:
```bash
cd backend && cp .env-example .env
```

Required variables for LLM and Google Cloud features:

| Variable | Description |
|----------|-------------|
| `PROJECT_ID` | Your Google Cloud Project ID. Required for Google Earth Engine (maps) and Translation services. |
| `LOCATION` | GCP region (e.g., `us-central1`). Primarily used for Cloud Run deployment and infrastructure management. |
| `LLM_API_KEY` | API key for Gemini/VertexAI. |
| `DATABASE_URL` | PostgreSQL connection string. |

### Frontend (`frontend/src/environments/environment.development.ts`)
Initialize the environment file:
```bash
cd frontend && cp src/environments/environment-example.ts src/environments/environment.development.ts
```

Required variables:

| Variable | Description |
|----------|-------------|
| `baseUrl` | API base URL (default: `http://localhost:8000`). |
| `mapsConfig.apiKey` | Your Google Maps API key for loading the map interface. |

---

## 🧪 Testing

### Run All Tests
```bash
make test
```

### Individual Components
- **Backend (pytest)**:
  ```bash
  cd backend
  uv run pytest
  ```
  Tests use an in-memory SQLite database by default.
- **Frontend (Karma/Jasmine)**:
  ```bash
  cd frontend
  npm run test:ci
  ```
- **Integration (Vitest)**:
  ```bash
  cd test
  npm install
  npm test
  ```
  *Note: Integration tests require a running backend.*

### Test Coverage Summary

| Layer | Test Type | Coverage |
|-------|-----------|----------|
| Backend API | pytest | Authentication, Location, Suggestions |
| Backend Services | pytest | Database, LLM, Business Logic |
| Frontend | Karma/Jasmine | Components, Services, Integration |
| Integration | Vitest | End-to-end API flows with LLM |

---

## 🔍 Troubleshooting

### Graphviz Errors
If you encounter errors related to `pygraphviz` during backend installation:
- **macOS**: `brew install graphviz`
- **Linux**: `sudo apt install graphviz-dev`

### API Client Resolution
If the frontend fails to find `@pac-api/client`:
1. Run `make build-client` from the root.
2. Ensure `client/dist` exists.
3. Run `pnpm install` in the `frontend` directory again.

### Port Conflicts
If port 8000 or 4200 is already in use:
```bash
make kill-port PORT=8000
make kill-port PORT=4200
```
