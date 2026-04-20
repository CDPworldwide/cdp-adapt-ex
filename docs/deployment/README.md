# Deployment & CI/CD Guide

This document provides a comprehensive overview of the deployment architecture, environment configuration, and CI/CD pipelines.

---

## 🏗 Part 1: Deployment & Infrastructure

The platform uses a fully serverless architecture on **Google Cloud Platform (GCP)**.

### Architecture Overview

Both the frontend (Angular) and backend (FastAPI) are containerized and deployed to **Cloud Run**.

```mermaid
flowchart TB
    subgraph GitHub["GitHub (CDPworldwide/pac-api)"]
        Actions[GitHub Actions]
        SecretsGH[GitHub Secrets]
    end

    subgraph GCP["Google Cloud Platform"]
        WIF[Workload Identity Federation]
        AR[Artifact Registry]
        CR_FE[Cloud Run: Frontend]
        CR_BE[Cloud Run: Backend]
        SM[Secret Manager]
        SQL[(Cloud SQL: PostgreSQL)]
    end

    Actions -->|Auth via| WIF
    Actions -->|Push Images| AR
    Actions -->|Deploy| CR_FE
    Actions -->|Deploy| CR_BE
    CR_BE -->|Fetch Sensitive Config| SM
    CR_FE -->|Fetch API Keys at Build| SM
    CR_BE -->|Query| SQL
    SecretsGH -->|Infra Config| Actions
```

### 🌍 Environments & Branching

We maintain separate environments for development, staging (previews), and production.

| Branch | Environment | Backend Service | Frontend Service | Cloud SQL Instance | Secret Prefix |
|--------|-------------|-----------------|------------------|-------------------|---------------|
| `main` | `development` | `cdp-server-dev` | `frontend-dev` | `cdp-test` | `development-` |
| `production` | `production` | `cdp-server-prod` | `frontend-prod` | `cdp-prod` | `production-` |
| `PR Previews` | `preview` | `cdp-server-preview-pr-X` | `frontend-preview-pr-X` | `cdp-test` | `development-` |

### 🛠 One-Time Infrastructure Setup

Before the first deployment, the following GCP infrastructure must be configured.

#### 1. Enable APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  iam.googleapis.com
```

#### 2. Create Artifact Registry
```bash
gcloud artifacts repositories create cdp \
  --repository-format=docker \
  --location=us-central1 \
  --description="CDP Docker images"
```

### 🔑 Configuration & Secrets

Secrets are split between GitHub (for CI/CD infrastructure) and GCP Secret Manager (for application runtime).

#### GCP Secret Manager
Sensitive variables must be defined in Secret Manager with the appropriate environment prefix. These are accessed by the application at runtime (Backend) or during the build process (Frontend).

| Secret Name | Description |
|-------------|-------------|
| `POSTGRES_PASSWORD` | Database user password. |
| `POSTGRES_HOST` | Database host (e.g., Cloud SQL Unix socket path). |
| `POSTGRES_DB` | Database name (e.g., `cdp`). |
| `POSTGRES_USER` | Database username. |
| `LLM_API_KEY` | API Key for Vertex AI / Gemini. |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated). |
| `GOOGLE_MAPS_API_KEY` | Google Maps API Key. |

### 📈 Monitoring & Logs

#### View Deployment Logs
```bash
# List revisions for a service
gcloud run revisions list --service [SERVICE_NAME] --region us-central1

# View logs for the latest revision
gcloud run services describe [SERVICE_NAME] --region us-central1 --format="value(status.latestReadyRevisionName)" | \
  xargs -I {} gcloud logging read "resource.labels.revision_name={}" --limit 50
```

#### Performance Metrics
Monitoring can be found in the [Cloud Run Console](https://console.cloud.google.com/run) under each service:
- **Metrics Tab**: Request count, latency, memory/CPU utilization.
- **Log Health**: Set up Cloud Monitoring alerts for error rate thresholds.

---

## 🚀 Part 2: CI/CD Pipelines

Our automation is handled via GitHub Actions, following a modular "Orchestrator" pattern.

### 🔑 GitHub-GCP Authentication (WIF)

Before the pipelines can run, you must establish a secure connection between GitHub and Google Cloud using **Workload Identity Federation (WIF)**. This eliminates the need for long-lived service account keys.

- **Workload Identity Pool**: `github-actions`
- **Provider**: `github`
- **Setup Link**: [Follow the official Google guide for WIF setup](https://github.com/google-github-actions/auth#direct-wif).

### 🔑 Required GitHub Secrets

The following repository secrets must be configured in GitHub (**Settings > Secrets and variables > Actions**) for the pipelines to function:

| Secret Name | Description |
|-------------|-------------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID. |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | The full resource name of the WIF provider (e.g., `projects/123/locations/global/workloadIdentityPools/github-actions/providers/github`). |
| `BASE_URL` | (Optional) The production URL of the backend, used if auto-detection fails. |

### Pipeline Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant GA as GitHub Actions
    participant WIF as Workload Identity
    participant GCP as Google Cloud
    participant CR as Cloud Run

    Dev->>GH: Push code / Open PR
    GH->>GA: Trigger workflow

    rect rgb(200, 220, 240)
        Note over GA,GCP: Backend Deployment
        GA->>WIF: Request OIDC token
        WIF->>GCP: Verify & exchange token
        GCP-->>GA: Short-lived credentials
        GA->>GCP: Push Docker image to Artifact Registry
        GA->>CR: Deploy backend to Cloud Run
    end

    rect rgb(220, 240, 200)
        Note over GA,CR: Frontend Deployment
        GA->>GA: Build Angular app
        GA->>GCP: Push Docker image to Artifact Registry
        GA->>CR: Deploy frontend to Cloud Run
    end

    GA-->>GH: Report status
    GH-->>Dev: Show result
```

### 1. Production & Development (`deploy.yml`)
Triggered on **push** to `main` or `production` branches.
- **Orchestration**: Deploys the backend first, verifies health via `/api/v1/health`, then builds the frontend with the correct `baseUrl` injected at compile time.
- **Verification**: Automatically rolls back if the backend health check fails.

### 2. PR Previews (`backend-deploy.yml` & `frontend.yml`)
Triggered on **pull request** updates.
- **Isolation**: Each PR gets a unique service name (`*-pr-{NUMBER}`).
- **Database**: Uses the `development` database and secrets.
- **Cleanup**: Previews are automatically deleted when PRs are closed.

---

## 🔍 Troubleshooting

### "Env var type" deployment error
If switching from a Secret Manager reference to a plain string (or vice-versa), Cloud Run may fail to update.
**Fix**: Delete the service and redeploy:
```bash
gcloud run services delete [SERVICE_NAME] --region us-central1
```

### Permission Denied (WIF)
Ensure the repository path in the IAM binding matches exactly: `CDPworldwide/pac-api`.

### Frontend connecting to wrong backend
The frontend build injects the backend URL at compile time. Ensure the `deploy-backend` job in `deploy.yml` finishes successfully and outputs the correct URL to the `deploy-frontend` job.
