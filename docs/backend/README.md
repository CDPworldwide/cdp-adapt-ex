# Backend Docs

The backend is the FastAPI service. It serves non-AI application APIs:

- Location search, map pins, and organization detail profiles.
- CSTAR hazards, goals, actions, funding-gap projects, peer solutions, and solution examples from Cloud SQL.
- Google Earth Engine hazard layer metadata and tile URLs.
- Google Cloud Translate-backed dynamic translation.
- Disclosure trend summaries.
- Onboarding role-selection telemetry.

Ask CDP AI chat and follow-up generation are owned by the separate [AI Server](/ai%20server).

## Documents

| Document | Purpose |
|----------|---------|
| [database.md](database.md) | SQLModel models, repository pattern, Cloud SQL connection settings, and app-owned tables. |
| [hazard-service.md](hazard-service.md) | Earth Engine integration and hazard layer API behavior. |

## Important Caveats

- CSTAR analytical tables are managed outside the app. The backend only auto-creates app-owned write tables, currently `UserRoleSelection`.
- Location detail reads still need a disclosure-year filtering decision before multiple disclosure years can safely coexist in the same table set.
- The database schema script lives at `scripts/create_empty_tables.sql`, not under `docs/`.
