# CDP Adaptation & Action Explorer - Backend

A FastAPI-based backend providing location, hazard, and translation APIs for the CDP Adaptation & Action Explorer platform.

## Tech Stack

- **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
- **Database:** [SQLModel](https://sqlmodel.tiangolo.com/) (SQLAlchemy + Pydantic) with PostgreSQL
- **Geospatial:** Google Earth Engine (Hazard data)
- **Package Management:** [uv](https://github.com/astral-sh/uv)

AI functionality is now owned by the separate `ai-server` service.

## Architecture Overview

```mermaid
flowchart TB
    subgraph External["External Clients"]
        FE[Frontend App]
        API_CLIENT[API Consumers]
    end

    subgraph Backend["CDP Adaptation & Action Explorer Backend"]
        subgraph API["API Layer"]
            LOC_API[Location Endpoints]
            HAZARD_API[Hazard Endpoints]
            TRANS_API[Translate Endpoints]
        end

        subgraph Core["Business Logic"]
            LOC_SVC[LocationDetailsService]
        end

        subgraph Services["Service Layer"]
            DB_SVC[DatabaseService]
            TRANSLATE[TranslateClient]
            EE_SVC[EarthEngineClient]
        end
    end

    subgraph External_Services["External Services"]
        PG[(PostgreSQL)]
        EE[Google Earth Engine]
        G_TRANS[Google Translate API]
    end

    FE --> API
    API_CLIENT --> API

    LOC_API --> LOC_SVC
    LOC_SVC --> DB_SVC

    HAZARD_API --> EE_SVC

    TRANS_API --> TRANSLATE

    DB_SVC --> PG
    EE_SVC --> EE
    TRANSLATE --> G_TRANS
```

## Project Structure

```text
backend/
├── app/
│   ├── api/v1/         # API routes (hazards, locations, translate)
│   ├── models/         # SQLModel database entities
│   ├── schemas/        # Pydantic API schemas
│   ├── services/       # Service clients and implementations
│   │   ├── clients/    # External API clients (Earth Engine, Translate)
│   │   ├── impls/      # Service implementations
│   │   └── interfaces/ # Service contracts (Protocols)
│   ├── shared/         # Configuration, logging, and common utilities
│   └── utils/          # Utilities
├── docs/               # Technical documentation
├── scripts/            # Utility and maintenance scripts
└── tests/              # Pytest suite
```

## Getting Started

For detailed installation and local development instructions, please refer to the **[root SETUP.md](../SETUP.md)**.

### Quick Start (Backend)

1. **Environment Setup**:
   ```bash
   cp .env-example .env
   ```
2. **Install Dependencies**:
   ```bash
   uv sync
   ```
3. **Run Server**:
   ```bash
   uv run fastapi dev app/main.py
   ```

The API will be available at `http://localhost:8000`.
Swagger documentation is at `http://localhost:8000/docs`.

### Testing

```bash
make test-backend
```

## Documentation

Detailed technical guides are available in the [docs/](./docs/) directory:

- [Database Layer](./docs/database.md): SQLModel entities, repositories, and connection pooling.
- [LLM Integration](./docs/llm-integration.md): Gemini API, follow-up suggestions, and chat completions.
- [Hazard Data Service](./docs/hazard-service.md): Earth Engine integration for geospatial layers.
