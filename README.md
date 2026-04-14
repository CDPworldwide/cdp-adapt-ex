# CDP Webapp

A full-stack web application with a FastAPI backend and Angular frontend.

## Overall App Structure

```
cdp-webapp/
├── backend/           # FastAPI Python backend
│   ├── app/
│   │   ├── api/       # API routes (v1)
│   │   ├── core/      # Core configuration, logging, metrics
│   │   ├── models/    # Database models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic services
│   │   └── utils/     # Utility functions
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/          # Angular frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/      # Core components (header, footer, auth)
│   │   │   ├── features/  # Feature modules (login, chat, maps, etc.)
│   │   │   └── shared/    # Shared components and services
│   │   └── environments/
│   ├── firebase.json
│   └── package.json
└── README.md
```

## Installation links

Before running the webapp locally, ensure you've installed all the dependencies. Note that you may need to restart the Terminal to apply the changes.

Backend:
- [gCloud](https://docs.cloud.google.com/sdk/docs/install#deb)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) - run
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```
- [PostgreSQL](https://www.postgresql.org/download/)
- `libgraphviz-dev` - run
   ```bash
   sudo apt install graphviz-dev
   ```

Frontend:
- [Node.js / NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
  - note that Node version v24.11.1 (`node -v`) and npm version 11.6.2 (`npm -v`) worked for us
- [Angular](https://angular.dev/installation)

## Setup

### Set up PostgreSQL

1. Verify Postgres is listening on TCP
```bash
pg_isready -h localhost -p 5432
```


2. If needed, start Postgres
```bash
sudo systemctl start postgresql
```

3. Create the database if it doesn't exist
```bash
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE cdp;"
```

### Set up backend dependencies

1. **Navigate to the backend directory**:

   ```bash
   cd backend
   ```

2. **Create a virtual environment**:

   ```bash
   uv venv
   ```

3. **Activate the virtual environment**:

   ```bash
   source .venv/bin/activate
   ```

4. **Sync dependencies**:

   ```bash
   uv sync
   ```

5. **Set up environment variables**:

   ```bash
   cp .env-example .env
   # Edit .env with your configuration
   ```

### Set up frontend dependencies

6. **Navigate to the frontend directory**:

   ```bash
   cd frontend
   ```

7. **Install dependencies**:

   ```bash
   npm install
   ```

8. **Generate the API client**:

   ```bash
   npm run client
   ```

   This populates the generated files under `client/` that are intentionally not tracked in git.

9. **Set up environment**:

   ```bash
   cp src/environments/environment-example.ts src/environments/environment.development.ts
   ```
   Make sure to update the baseUrl parameter to point the frontend to your locally hosted frontend, which by default, is `localhost:8000`.
   ```bash
   baseUrl: 'http://localhost:8000'
   ```

   Edit the rest of the configuration as needed.

## Quick Start with Makefile

The project includes a Makefile to simplify common development tasks. Run `make help` to see all available commands.

### First-time setup

```bash
make install          # Install all dependencies (backend + frontend)
make setup-hooks      # Install pre-commit hooks for automated linting
```

### Common commands

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make test` | Run all tests |
| `make lint` | Run linting checks |
| `make lint-fix` | Auto-fix linting issues |
| `make clean` | Clean build artifacts |
| `make db-check` | Check PostgreSQL status |
| `make db-create` | Create CDP database |

### Pre-commit hooks

Pre-commit hooks run automatically before each commit to enforce code quality:
- **ruff**: Python linting and formatting (backend)
- **prettier**: JavaScript/TypeScript formatting (frontend)
- **trailing-whitespace**: Remove trailing whitespace
- **end-of-file-fixer**: Ensure files end with a newline

To skip hooks for a single commit: `git commit --no-verify`

To run hooks manually on all files: `pre-commit run --all-files`

## Run the webapp locally

The frontend is an Angular 20 application with Angular Material. The backend is a FastAPI application running on Python 3.13. To run the app locally, you'll need to run the backend + frontend in two separate terminals.

### Terminal 1: Backend

1. **Navigate to the backend directory**:

   ```bash
   cd backend
   ```

2. **Create a virtual environment if one doesn't exist yet**:

   ```bash
   uv venv
   ```

3. **Activate the virtual environment**:

   ```bash
   source .venv/bin/activate
   ```

4. **Run the development server**:

   ```bash
   uv run fastapi dev app/main.py
   ```

The API will be available at `http://localhost:8000`

### Terminal 2: Frontend

1. **Navigate to the frontend directory**:

   ```bash
   cd frontend
   ```

2. **Start the development server**:

   ```bash
   ng serve
   ```

   If this is a fresh clone and the frontend cannot resolve `@pac-api/client`, run `npm run client:install` once and then `npm run client:generate` from the repo root first.

The app will be available at `http://localhost:4200`

### Example organization ID links

Use these direct links to load a location by organization ID in the frontend:

- `http://localhost:4200/city/3203` (City of Chicago, IL)
- `http://localhost:4200/city/54125` (City of Boise, ID)
- `http://localhost:4200/city/31178` (City of Mumbai)
- `http://localhost:4200/city/35907` (Bengaluru)
- `http://localhost:4200/city/867355` (Junagadh)
- `http://localhost:4200/city/63836` (Vadodara Municipal Corporation)

Optional invalid ID example (expected not-found behavior):

- `http://localhost:4200/city/999999`

## Testing

The project includes comprehensive testing across backend, frontend, and integration layers.

### Quick Test Commands

```bash
# Run all tests (backend + frontend)
npm test

# Run only backend tests
npm run test:backend

# Run only frontend tests
npm run test:frontend

# Run integration tests (chatbot API)
npm run test:chat
```

### Client Generation

The local `client/` package has two different kinds of files:

- Hand-written setup and tooling, such as `client/package.json`, `client/openapi-ts.config.ts`, and `client/scripts/`
- Generated outputs under `client/src/` and `client/dist/`

The tracked API contract is `client/openapi.json`. Prefer reviewing API changes there, then treat the generated TypeScript output as mechanical.

```bash
# Install generator dependencies once
npm run client:install

# Generate SDK files from the tracked OpenAPI snapshot
npm run client:generate

# Refresh the snapshot from the backend and regenerate
npm run client:refresh

# Check whether generated client artifacts are present
npm run client:check
```

See `client/README.md` for the intended workflow.

### Backend Tests (Python/pytest)

Located in `backend/tests/`

**Running backend tests:**
```bash
cd backend
uv run pytest

# With verbose output
uv run pytest -v

# Run specific test file
uv run pytest tests/api/v1/test_auth.py

# With coverage
uv run pytest --cov=app
```

**Test structure:**
- `tests/api/v1/` - API endpoint tests
- `tests/core/` - Business logic tests
- `tests/services/` - Service layer tests
- `tests/unit/` - Unit tests
- `conftest.py` - Test fixtures and configuration

Tests use SQLite in-memory database for isolation. No external database required.

### Frontend Tests (Angular/Karma/Jasmine)

Located in `frontend/src/app/`

**Running frontend tests:**
```bash
cd frontend

# Run once
npm run test:ci

# Watch mode
ng test

# With coverage
ng test --code-coverage
```

**Test structure:**
- Component tests (`.spec.ts` files alongside components)
- Service tests
- Integration tests

### Integration Tests (TypeScript/Vitest)

Located in `test/` directory

**Prerequisites:**

1. Set in `backend/.env`:
   ```bash
   APP_ENV=development
   ```

2. Restart the backend server

3. Run integration tests

**Running integration tests:**
```bash
cd test

# Install dependencies (first time only)
npm install

# Run all integration tests
npm test

# Run chatbot tests only
npm run test:chat

# Watch mode
npm run test:watch
```

See `test/README.md` for detailed integration testing documentation.


### Test Coverage Summary

| Layer | Test Type | Coverage |
|-------|-----------|----------|
| Backend API | pytest | Authentication, Location, Suggestions |
| Backend Services | pytest | Database, LLM, Business Logic |
| Frontend | Karma/Jasmine | Components, Services, Integration |
| Integration | Vitest | End-to-end API flows with LLM |

### Continuous Integration

Pre-commit hooks ensure code quality:
```bash
make setup-hooks  # Install hooks

# Hooks automatically run:
# - Python linting (ruff)
# - TypeScript formatting (prettier)
# - Whitespace cleanup
```

To run hooks manually:
```bash
pre-commit run --all-files
```

## Deployment

### Automatic Deployment (CI/CD)

Deployments trigger automatically when changes are pushed to `main`:

| Component | Target | Trigger |
|-----------|--------|---------|
| Backend (`backend/**`) | Cloud Run | Push to `main` |
| Frontend (`frontend/**`) | Firebase Hosting | Push to `main` |

### Manual Frontend Deployment

Use these steps to deploy the frontend manually without the CI/CD pipeline:
1. **Build the production bundle**:

   ```bash
   cd frontend
   ng build
   ```

2. **Initialize Firebase** (first time only):

   ```bash
   firebase init
   ```

   - Select **Hosting**
   - Choose your Firebase project
   - Set the public directory to: `dist/frontend/browser`
   - Configure as a single-page app: **Yes**
   - Do not overwrite `index.html`

3. **Deploy to Firebase Hosting**:
   ```bash
   firebase deploy
   ```
