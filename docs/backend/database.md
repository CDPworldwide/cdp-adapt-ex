# Database Layer

The database layer uses SQLModel (SQLAlchemy + Pydantic) with a repository pattern for clean separation of concerns.

## File Locations

| Component | Path |
|-----------|------|
| **Models** | `backend/app/models/location_details.py` |
| **Repository** | `backend/app/services/clients/database/location_details_repository.py` |
| **Service (Singleton)** | `backend/app/services/clients/database/base.py` |

## DatabaseService

The `DatabaseService` is a singleton that manages the database connection pool and provides access to repositories. It is initialized during the FastAPI application lifespan.

### Core Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Creates the SQLAlchemy async engine and connection pool. |
| `get_session_maker()` | Returns a new `AsyncSession` for manual database operations. |
| `health_check()` | Verifies the database connection is active. |
| `close()` | Disposes of the engine and connection pool. |

### Repository Access

Repositories are accessible via properties on the `database_service` instance:

```python
from app.services.clients.database import database_service

# Access the location details repository
repo = database_service.location_details
```

## Entity Models

The system uses several SQLModel entities mapped to the Cities, States and Regions datasets.

### Core Models (Cities, States and Regions 2025)

- **`DimCentral`**: Central dimension table for jurisdiction metadata and geometry.
- **`FactHazards`**: Environmental hazards reported by jurisdictions.
- **`FactAdaptationGoals`**: Climate adaptation goals.
- **`FactActions`**: Specific adaptation actions taken or planned.
- **`FactProjects`**: Projects seeking funding (Funding Gap).
- **`PeerSolutions`**: Adaptation actions taken by similar jurisdictions.
- **`SolutionsExamples`**: Detailed examples of peer solutions.
- **`UserRoleSelection`**: App-owned onboarding telemetry table that is auto-created by the backend on startup.

## Repositories

### LocationDetailsRepository

This is the primary repository for retrieving jurisdiction-level data.

| Method | Description |
|--------|-------------|
| `get_orgs_by_name(name)` | Case-insensitive search for organizations. |
| `get_metadata(org_id)` | Retrieves core details and geometry for an organization. |
| `get_hazards(org_id)` | Returns all hazards for an organization. |
| `get_actions(org_id)` | Returns adaptation actions. |
| `get_goals(org_id)` | Returns adaptation goals. |
| `get_projects(org_id)` | Returns projects seeking funding. |
| `get_all_location_summaries()` | Used for search suggestions. |
| `get_all_location_geometries()` | Used for map pins. |

## Usage Pattern

```python
from app.services.clients.database import database_service

# Query metadata and hazards for a city
orgs = await database_service.location_details.get_orgs_by_name("London")
if orgs:
    org_id = orgs[0].id
    metadata = await database_service.location_details.get_metadata(org_id)
    hazards = await database_service.location_details.get_hazards(org_id)
```

## Testing & SQLite Fallback

To support local testing without a full PostGIS instance, the codebase uses a `SafeGeometry` type decorator. This allows the geometry columns to fall back to standard `TEXT` when running against a SQLite database (e.g., in unit tests).

## Configuration

Environment variables for database connection:

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | Database host | `localhost` |
| `POSTGRES_PORT` | Database port | `5432` |
| `POSTGRES_DB` | Database name | `cdp` |
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_PASSWORD` | Database password | empty string |
| `POSTGRES_POOL_SIZE` | Connection pool size | `20` |
| `POSTGRES_MAX_OVERFLOW` | Max overflow connections | `10` |
