# Recommended Documentation Additions

These are the highest-value docs still worth adding to keep the handoff complete after the backend/AI server split.

## Add Next

| Proposed doc | Why it matters |
|--------------|----------------|
| `docs/architecture.md` | One current diagram showing frontend, backend, AI server, Cloud SQL, Earth Engine, Translate, Secret Manager, and Cloud Run. The architecture is now split enough that new contributors need a single map. |
| `docs/operations.md` | Runbook for launch-day and incident handling: Cloud Run logs, AI server failures, backend health checks, rate limits, Cloud SQL saturation, and rollback steps. |
| `docs/ai server/prompt-ops.md` | Prompt update workflow, Gist sync/manual update steps, cache behavior, evaluation loop, and what changes do or do not trigger Cloud Run deploys. |
| `docs/data-refresh.md` | Annual CSTAR refresh process from raw Excel/BigQuery through Cloud SQL import, including how to handle multiple disclosure years safely. |
| `docs/security-and-config.md` | API key model, CORS, public frontend build-time secrets, Secret Manager names, WIF repository binding, and what must not be committed. |
| `docs/frontend.md` | Current Angular app feature map, route structure, generated client use, AI server direct-call contract, and i18n conventions. |
| `docs/testing.md` | Single test matrix across backend, AI server, frontend, generated client, integration tests, chat evals, and load tests. |

## Known Cleanup Items

- Publish or link the seven-file CSTAR CSV archive referenced from [data.md](data.md).
- Decide and document the disclosure-year strategy before loading additional CSTAR years into the same Cloud SQL tables.
- Reconcile service names in GCP and docs if `frontend` vs `frontend-prod` is intentionally changing or just deployment drift.
- Move any remaining handoff-only material from `frontend/input/Google x CDP Technical Docs.md` into the canonical docs here, then archive the raw handoff file.
