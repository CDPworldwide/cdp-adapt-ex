---
title: "Backend"
description: "FastAPI service docs for location profiles, hazards, translation, disclosure trends, and onboarding telemetry."
---

# Backend

The backend is the FastAPI service. It serves non-AI application APIs and owns the data-facing contract used by the Angular frontend and generated TypeScript client.

## Responsibilities

| Area | Notes |
|------|-------|
| Location profiles | Search, map pins, and organization detail payloads assembled from Cities, States and Regions Cloud SQL tables. |
| Cities, States and Regions data | Hazards, adaptation goals, actions, funding-gap projects, peer solutions, and solution examples. |
| Hazard layers | Google Earth Engine layer config and tile URLs for climate-hazard map overlays. |
| Translation | Dynamic Google Cloud Translate endpoint used by frontend `autoTranslate` flows. |
| Disclosure trends | Dataset-wide disclosure summaries for a selected year. |
| Onboarding telemetry | App-owned role-selection table created by the backend on startup. |

Ask the AI Explorer chat and follow-up generation are owned by the separate [AI Server](/ai-server/).

## Backend Docs

| Page | Purpose |
|------|---------|
| [Database Layer](database) | SQLModel models, repository pattern, Cloud SQL settings, and app-owned tables. |
| [Hazard Data Service](hazard-service) | Earth Engine integration and hazard layer API behavior. |

## Caveats

- Cities, States and Regions analytical tables are managed outside the app. The backend only auto-creates app-owned write tables, currently `UserRoleSelection`.
- Location detail reads still need a disclosure-year filtering decision before multiple disclosure years can safely coexist in the same table set.
- The database schema script lives at `scripts/create_empty_tables.sql`, not under `docs/`.
