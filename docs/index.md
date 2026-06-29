---
title: "CDP Adaptation & Action Explorer"
description: "How the CDP Adaptation & Action Explorer is structured and operated."
---

# CDP Adaptation & Action Explorer

The CDP Adaptation & Action Explorer helps cities, states and regions understand climate hazards, compare adaptation work, and discover practical examples from peer jurisdictions. Economic development authorities, businesses, public and private funders, non-governmental organizations, journalists and researchers can also use the tool to better understand government action and identify opportunities for collaboration.

At a high level, the app combines public Cities, States and Regions disclosure data, climate hazard layers, jurisdiction geometry, translation services, and an Ask the AI Explorer assistant into one exploration tool. Public source datasets are available through CDP's [Cities, States and Regions Open Data Portal](https://data.cdp.net/browse?category=Cities%2C+States+%26+Regions).

## How It Works

| Part | What it does |
|------|--------------|
| Frontend | Angular app for search, maps, location detail pages, translated content, and Ask the AI Explorer. |
| Backend | FastAPI service for location data, Cities, States and Regions tables, Earth Engine hazard layers, translation, disclosure trends, and onboarding telemetry. |
| AI Server | Standalone OpenAI-compatible service for Ask the AI Explorer chat and follow-up suggestions. |
| Data | Cities, States and Regions 2025 analytical tables loaded into PostgreSQL/Cloud SQL with PostGIS geometry. |
| Deployment | Cloud Run services deployed through GitHub Actions and configured through Secret Manager. |

## Start Here

| Area | What it covers |
|------|----------------|
| [Backend](backend/) | FastAPI APIs, Cloud SQL repositories, Earth Engine hazard layers, translation, disclosure trends, and onboarding telemetry. |
| [AI Server](ai-server/) | OpenAI-compatible Ask the AI Explorer routes, prompt handling, Gemini integration, and reviewed-question testing. |
| [Data Setup](data) | Cities, States and Regions 2025 Cloud SQL table setup, BigQuery export notes, PostGIS cleanup, and table schema summary. |
| [Deployment](deployment) | Cloud Run services, GitHub Actions workflows, Secret Manager, WIF, and preview deployments. |
| [Translation](translation) | Static frontend translations and dynamic Google Cloud Translate flow. |

See the sidebar for additional docs that should still be added as the project continues to settle.
