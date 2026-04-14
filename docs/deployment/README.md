# CI/CD Deployment Setup Guide

Automatic deployments to Cloud Run for both frontend and backend based on the target branch.

> **Regular deployments:**
> - Push to `main` to deploy to the **Development** environment.
> - Push to `production` to deploy to the **Production** environment.

## Overview

| Branch | Environment | Backend Service | Frontend Service | Secret Prefix |
|--------|-------------|-----------------|------------------|---------------|
| `main` | `development` | `cdp-server-dev` | `frontend-dev` | `development-` |
| `production` | `production` | `cdp-server-prod` | `frontend-prod` | `production-` |
| `PR Previews` | `development` | `cdp-server-preview-pr-X` | `frontend-preview-pr-X` | `development-` |

All workflows can be triggered manually via `workflow_dispatch`.

### PR Preview Deployments

When a PR is opened against `main` or `production`, the workflow automatically deploys to a temporary preview environment:
- **Environment:** Uses `development` configuration and secrets.
- **Isolation:** Each PR gets its own isolated Cloud Run services.
- **Cleanup:** Preview services are automatically deleted when the PR is closed.

A comment is added to the PR with the preview URL.

## Secret Management

We use **GCP Secret Manager** as the single source of truth for sensitive environment configuration.

### Secret Naming Convention
Secrets must be prefixed with the environment name:
- `development-<SECRET_NAME>`
- `production-<SECRET_NAME>`

### Required Secrets in GCP
The following secrets must be defined in GCP Secret Manager for **both** prefixes:

| Secret Name | Description |
|-------------|-------------|
| `POSTGRES_PASSWORD` | Password for the Cloud SQL user |
| `POSTGRES_HOST` | Unix Socket Path for Cloud Run: `/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME` |
| `POSTGRES_DB` | Name of the PostgreSQL database |
| `POSTGRES_USER` | Username for the PostgreSQL database |
| `LLM_API_KEY` | Google VertexAI / Gemini API Key |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) |
| `FIREBASE_API_KEY` | Frontend Firebase API Key |
| `FIREBASE_AUTH_DOMAIN` | Frontend Firebase Auth Domain |
| `FIREBASE_PROJECT_ID` | Frontend Firebase Project ID |
| `GOOGLE_MAPS_API_KEY` | Frontend Google Maps API Key |

### Cloud SQL Instances
The environments are hardcoded to point to separate Cloud SQL instances:
- **Development:** `cdp-dev`
- **Production:** `cdp-prod`

## Architecture Overview

```mermaid
flowchart TB
    subgraph GitHub["GitHub Repository"]
        PR[Pull Request]
        Main[Main Branch]
        Actions[GitHub Actions]
    end

    subgraph GCP["Google Cloud Platform"]
        WIF[Workload Identity Federation]
        AR[Artifact Registry]
        CR[Cloud Run]
    end

    PR -->|triggers| Actions
    Main -->|triggers| Actions
    Actions -->|authenticates via| WIF
    WIF -->|grants access to| AR
    WIF -->|grants access to| CR
    Actions -->|pushes Docker images| AR
    AR -->|deploys backend & frontend to| CR
```

## CI/CD Pipeline Flow

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

## Quick Links

- **GitHub Secrets:** https://github.com/CDPworldwide/pac-api/settings/secrets/actions
- **Cloud Run Console:** https://console.cloud.google.com/run
- **Artifact Registry:** https://console.cloud.google.com/artifacts

## First Deployment Order

```mermaid
flowchart LR
    A[1. Configure all secrets] --> B[2. Deploy Backend]
    B --> C[3. Get Cloud Run URL]
    C --> D[4. Set BASE_URL secret]
    D --> E[5. Deploy Frontend]
    E --> F[6. Verify both services]
```

1. Complete [Backend Deployment Setup](./backend.md) first
2. Get the Cloud Run URL after deployment
3. Set `BASE_URL` GitHub secret with the Cloud Run URL
4. Complete [Frontend Deployment Setup](./frontend.md)

## Troubleshooting

### "Permission denied" on Workload Identity

Ensure the repository name in the IAM binding matches exactly (case-sensitive):
```bash
gcloud iam service-accounts get-iam-policy github-actions-deployer@PROJECT_ID.iam.gserviceaccount.com
```

### Tests fail in CI but pass locally

Check environment variables - CI may be missing secrets or have different values.

### Updating Secrets

**Google Cloud Secret Manager:**
```bash
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-
```

**GitHub Secrets:**
1. Go to Settings → Secrets and variables → Actions
2. Click on the secret
3. Click "Update" and paste the new value

---

## PR Preview Deployments

The `backend-deploy.yml` workflow handles both production and preview deployments:

```mermaid
flowchart LR
    subgraph PR["Pull Request"]
        Open[PR Opened/Updated]
    end

    subgraph Preview["Preview Environment"]
        PrevCR[cdp-server-preview]
        PrevDB[(dev database)]
    end

    subgraph Prod["Production"]
        ProdCR[cdp-server]
        ProdDB[(cdp database)]
    end

    Open -->|deploy| PrevCR
    PrevCR -->|connects to| PrevDB

    Merge[PR Merged] -->|deploy| ProdCR
    ProdCR -->|connects to| ProdDB
```

### How It Works

| Event | Service | Database | APP_ENV |
|-------|---------|----------|---------|
| PR opened/updated | `cdp-server-preview` | `dev` | `staging` |
| PR merged to main | `cdp-server` | `cdp` | `production` |

When a PR is opened, the workflow:
1. Runs tests
2. Deploys to `cdp-server-preview`
3. Comments on the PR with the preview URL

When the PR is merged, the workflow:
1. Runs tests
2. Deploys to production `cdp-server`
