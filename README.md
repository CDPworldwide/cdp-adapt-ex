# CDP Adaptation & Action Explorer

A unified platform to synthesize fragmented environmental hazard data and siloed resilience best practices, empowering subnational governments to drive Earth-positive action.

> TODO: Insert tool link after it is launched.

## 📱 Preview

![CDP Adaptation & Action Explorer Landing Page](docs/images/landing-page.png)
*Explore local climate hazards and adaptation projects worldwide.*

## 🚀 Getting Started

Please see **[SETUP.md](SETUP.md)** for detailed installation instructions.

## 🏗 Architecture & Core Concepts

### Overall App Structure

```
pac-api/
├── backend/           # FastAPI (Python 3.13)
│   ├── app/
│   │   ├── api/v1/    # Endpoint definitions & Pydantic schemas
│   │   ├── services/  # Business logic & LLM clients
│   │   │   └── clients/database/ # Data Access Layer (Repositories)
│   │   ├── models/    # SQLModel database models
│   │   ├── core/      # Config, security, logging
│   │   └── main.py    # FastAPI entry point
│   ├── pyproject.toml # Package management via `uv`
│   └── tests/         # Pytest suite
├── client/            # Auto-generated TypeScript API client
│   ├── scripts/       # Generation & patching scripts
│   └── src/           # Generated models and services
├── frontend/          # Angular 20 & Tailwind CSS
│   ├── src/app/
│   │   ├── core/      # Singleton services, guards, interceptors
│   │   ├── features/  # Domain features (Map, Chat, Hazard, etc.)
│   │   └── shared/    # Reusable components & UI building blocks
│   └── tailwind.config.js
├── data/              # Seed data & migration sources
└── Makefile           # Project automation (install, test, lint)
```

### Infrastructure & Cloud Architecture

The platform is built on Google Cloud Platform (GCP).

- **Compute (Cloud Run)**: Both the FastAPI backend and Angular frontend are  hosted on Cloud Run.
- **Database (Cloud SQL)**: A managed PostgreSQL instance stores all environmental hazards, organizational data, and user sessions.
- **AI & LLM (Vertex AI)**: Integrates with Google's Gemini models to power the chat interface and synthesize complex hazard data.
- **Geospatial (Google Maps)**: Provides the map-based visualization for hazards and adaptation actions.

## 🚀 Deployment

For detailed information on automatic CI/CD pipelines and manual deployment steps, please refer to the **[Deployment Documentation](docs/deployment/README.md)**.

## 📚 Documentation Index

| Topic | Description |
|-------|-------------|
| 🛠 **[SETUP.md](SETUP.md)** | Step-by-step local development environment setup. |
| 🤝 **[CONTRIBUTING.md](CONTRIBUTING.md)** | Guidelines for reporting bugs, suggesting features, and PR workflows. |
| 🚀 **[Deployment Guide](docs/deployment/README.md)** | CI/CD pipelines, Cloud Run configuration, and manual deployment. |
| 🧪 **[Testing](SETUP.md#-testing)** | Overview of testing strategies, or module-specific details in [Backend Tests](backend/tests/README.md) and [Frontend Tests](frontend/README.md#-testing). |
| ⚙️ **[Backend Docs](backend/README.md)** | FastAPI architecture, services, and database repository pattern. |
| 📊 **[Data & DB Docs](backend/docs/database.md)** | Database schema, seed data, and data management details. |
| 🎨 **[Frontend Docs](frontend/README.md)** | Angular 20 structure, Tailwind CSS usage, and component patterns. |
| 🔒 **[SECURITY.md](SECURITY.md)** | Vulnerability reporting and security policies. |
| 📄 **[LICENSE](LICENSE)** | Project licensing information. |
