# CDP AI Server

Standalone OpenAI-compatible AI server for Ask CDP AI.

## Routes

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`

`/v1/chat/completions` supports non-streaming OpenAI-style JSON responses and
OpenAI-compatible Server-Sent Event chunks when `stream: true`.

Location context can be sent either as `metadata.locationData` or top-level
`locationData`.

## Local Mock Run

```bash
AI_SERVER_MOCK_RESPONSE='Mock response for {location}' \
AI_SERVER_API_KEY=local-ai-key \
uv run uvicorn app.main:app --host 127.0.0.1 --port 8088
```

## Curl

```bash
curl http://127.0.0.1:8088/v1/models \
  -H 'Authorization: Bearer local-ai-key'
```

```bash
curl http://127.0.0.1:8088/v1/chat/completions \
  -H 'Authorization: Bearer local-ai-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "cdp-gemini",
    "messages": [{"role": "user", "content": "What hazards are listed?"}],
    "metadata": {"locationData": {"name": "São Paulo"}}
  }'
```

```bash
curl -N http://127.0.0.1:8088/v1/chat/completions \
  -H 'Authorization: Bearer local-ai-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "cdp-gemini",
    "stream": true,
    "messages": [{"role": "user", "content": "Summarize this location."}],
    "metadata": {"locationData": {"name": "Jakarta"}}
  }'
```

## Real Gemini Run

```bash
LLM_API_KEY=... \
AI_SERVER_API_KEY=... \
LLM_MODEL=gemini-3-flash-preview \
uv run uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Reviewed Location Grounding Data

The reviewed interactions in `comments.csv` are grounded by endpoint-shaped
location fixtures in `org-data/{organizationId}.json`. These files were fetched
for the organization IDs in `comments.csv` through the Cloud SQL proxy on port
`55432`, using the same backend service path as
`GET /api/v1/locations/id/{organization_id}` and with `geometry` stripped before
AI prompt injection.

To refresh the source data, start or reuse the proxy:

```bash
../backend/scripts/start_cloud_sql_proxy.sh
```

Then confirm the reviewed organizations are reachable:

```bash
POSTGRES_DB=$(grep '^POSTGRES_DB=' ../backend/.env | cut -d= -f2-)
POSTGRES_USER=$(grep '^POSTGRES_USER=' ../backend/.env | cut -d= -f2-)
POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' ../backend/.env | cut -d= -f2-)
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h 127.0.0.1 \
  -p 55432 \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -c 'select cdp_disclosing_org_number, disclosing_organization from "CSTAR_2025_Dim_Central" where cdp_disclosing_org_number in (831391,10894,31176,73051,31169,74594);'
```

## Update Remote System Prompt

The deployed AI server reads `SYSTEM_PROMPT` from this stable public Gist URL:

```text
https://gist.githubusercontent.com/andrewm-bakerst/fa841de953aed344794b1fc0281069d1/raw/system_prompt.md
```

Upload `app/prompts/system_prompt.md` to that Gist:

```bash
uv run update-system-prompt
```

The script updates Gist `fa841de953aed344794b1fc0281069d1` and prints the fixed
raw URL. Remote prompts are re-fetched after `SYSTEM_PROMPT_CACHE_SECONDS` so
Gist edits can be picked up without restarting the server.

Local runs use `AI_SYSTEM_PROMPT_GIST_TOKEN`, `GIST_TOKEN`, `GH_TOKEN`, or the
active `gh` auth token. The GitHub Actions prompt sync workflow can run the same
command when `AI_SYSTEM_PROMPT_GIST_TOKEN` is configured as a repository secret.
