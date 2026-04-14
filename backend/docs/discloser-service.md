# Discloser Service Client

The discloser service client fetches geometry data for a specific organization ID (CRM account key) from the external discloser profile service.

## Purpose

- Expose a reusable client for geometry lookup by organization ID.
- Centralize external URL configuration so environments can be switched without code changes.
- Return only the geometry payload used by downstream callers.

## Client

**Interface:** `app/services/interfaces/discloser_client.py`

**Implementation:** `app/services/impls/discloser_client_impl.py`

### get_geometry_by_organization_id()

Fetches geometry from the external endpoint:

`GET /api/v1/db/crm_entity/{organization_id}/geometry`

Method signature:

```python
def get_geometry_by_organization_id(self, organization_id: str) -> dict[str, Any] | None:
```

Behavior:

- Returns `dict[str, Any]` when geometry is present.
- Returns `None` when the organization is not found (`404`) or the response geometry is `null`.
- Raises `RuntimeError` for network failures and non-404 HTTP errors.
- Raises `RuntimeError` if geometry is present but not an object.

## Configuration

The client base URL is configurable via environment variable:

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCLOSER_SERVICE_BASE_URL` | `https://discloser-profile-service-pbybuiwoxq-uc.a.run.app` | Base URL for discloser profile service |

## Dependency Injection

**Source:** `app/api/v1/deps.py`

```python
def get_discloser_client() -> DiscloserClient:
    return discloser_client
```

Use this dependency in routes/services to avoid creating new client instances per request.

## Example Usage

```python
geometry = discloser_client.get_geometry_by_organization_id("918262")
if geometry is None:
    # no geometry for this organization ID
    ...
```
