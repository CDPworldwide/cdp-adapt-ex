# Documentation Index

This directory is the canonical handoff documentation for the current `cdp-adapt-ex` setup.

## System Areas

| Area | Document | Notes |
|------|----------|-------|
| Backend | [backend](backend/README.md) | FastAPI APIs, database repositories, Earth Engine hazard layers. |
| AI server | [ai-server](ai-server/) | Standalone OpenAI-compatible Ask the AI Explorer service. |
| Data setup | [data.md](data.md) | Cities, States and Regions 2025 table import, Cloud SQL/PostGIS setup, BigQuery export notes. |
| Data pipeline | [data_pipeline.md](data_pipeline.md) | End-to-end runbook for full application data updates (Stage 1 notebook → Stage 2 finalize → Stage 3 BQ → Cloud SQL migration). |
| Deployment | [deployment.md](deployment.md) | Cloud Run services, GitHub Actions workflows, secrets, WIF. |
| Translation | [translation.md](translation.md) | Static frontend translations and dynamic Google Translate flow. |

## Known Documentation Backlog

See the main docs sidebar for the highest-value docs still worth adding after the backend/AI split.
