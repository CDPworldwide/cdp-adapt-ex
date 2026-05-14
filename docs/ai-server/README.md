# AI Server Docs

The AI server is the standalone OpenAI-compatible service for Ask CDP AI. The Angular frontend calls it directly for chat and suggested follow-up questions.

## Runtime Contract

| Route | Purpose |
|-------|---------|
| `GET /healthz` | Health check. |
| `GET /v1/models` | OpenAI-compatible model listing. |
| `POST /v1/chat/completions` | Chat completions. Supports JSON responses and SSE streaming when `stream: true`. |
| `POST /v1/suggest-follow-ups` | Suggested follow-up questions for the current location/context. |

Location context may be sent as `metadata.locationData` or top-level `locationData`. The frontend currently sends both for compatibility.

## Documents

| Document | Purpose |
|----------|---------|
| [testing.md](testing.md) | Reviewed-question testing, batch evals, and prompt iteration workflow. |

## Local Run

Mocked response:

```bash
cd ai-server
AI_SERVER_MOCK_RESPONSE='Mock response for {location}' \
AI_SERVER_API_KEY=local-ai-key \
uv run uvicorn app.main:app --host 127.0.0.1 --port 8088
```

Real Gemini response:

```bash
cd ai-server
LLM_API_KEY=... \
AI_SERVER_API_KEY=... \
LLM_MODEL=gemini-2.5-flash \
uv run uvicorn app.main:app --host 127.0.0.1 --port 8088
```

The deployed service reads `SYSTEM_PROMPT` from a stable Gist URL and refreshes it after `SYSTEM_PROMPT_CACHE_SECONDS`. Prompt-only edits to `ai-server/app/prompts/system_prompt.md` do not automatically deploy the service.
