---
title: "CDP Adaptation & Action Explorer"
description: "How the CDP Adaptation & Action Explorer is structured and operated."
---

# CDP Adaptation & Action Explorer

The CDP Adaptation & Action Explorer helps local and regional governments understand climate hazards, compare adaptation work, and discover practical examples from peer jurisdictions.

At a high level, the app combines public CSTAR disclosure data, climate hazard layers, jurisdiction geometry, translation services, and an Ask CDP AI assistant into one exploration tool.

## How It Works

| Part | What it does |
|------|--------------|
| Frontend | Angular app for search, maps, location detail pages, translated content, and Ask CDP AI. |
| Backend | FastAPI service for location data, CSTAR tables, Earth Engine hazard layers, translation, disclosure trends, and onboarding telemetry. |
| AI Server | Standalone OpenAI-compatible service for Ask CDP AI chat and follow-up suggestions. |
| Data | CSTAR 2025 analytical tables loaded into PostgreSQL/Cloud SQL with PostGIS geometry. |
| Deployment | Cloud Run services deployed through GitHub Actions and configured through Secret Manager. |

## Start Here

| Area | What it covers |
|------|----------------|
| [Backend](backend/) | FastAPI APIs, Cloud SQL repositories, Earth Engine hazard layers, translation, disclosure trends, and onboarding telemetry. |
| [AI Server](ai-server/) | OpenAI-compatible Ask CDP AI routes, prompt handling, Gemini integration, and reviewed-question testing. |
| [Data Setup](data) | CSTAR 2025 Cloud SQL table setup, BigQuery export notes, PostGIS cleanup, and table schema summary. |
| [Deployment](deployment) | Cloud Run services, GitHub Actions workflows, Secret Manager, WIF, and preview deployments. |
| [Translation](translation) | Static frontend translations and dynamic Google Cloud Translate flow. |

See the sidebar for additional docs that should still be added as the project continues to settle.
