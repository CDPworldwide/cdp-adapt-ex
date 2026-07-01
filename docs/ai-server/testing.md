# Testing Ask the AI Explorer

This repo includes a repeatable workflow for testing reviewed Ask the AI Explorer questions against the local AI server. Use it when improving answer quality, grounding, prompt behavior, or response reliability.

Run these commands from the `ai-server` directory unless noted otherwise.

## Test Data

Reviewed free-text feedback lives in:

```bash
comments.csv
```

Reviewed location fixtures live in:

```bash
org-data/<orgId>.json
```

The fixtures are endpoint-shaped location profiles fetched from the backend path `GET /api/v1/locations/id/{organization_id}`. They are used as `locationData` when replaying questions.

Approved follow-up question candidates live in:

```bash
app/data/approved_follow_up_questions.json
```

## Run One Question

Use this when tuning a specific bad answer:

```bash
script/run-test-question 831391 "has the city ranked the hazards in their disclosure?"
```

The script:

1. Starts a temporary local location stub backed by `org-data`.
2. Starts the AI server on a free local port.
3. Sends the question to `/v1/chat/completions`.
4. Prints the assistant response.
5. Cleans up both temporary servers.

It reads API keys from `.env`. Transient failures are retried by default.

Optional retry controls:

```bash
TEST_QUESTION_RETRIES=4 TEST_QUESTION_BACKOFF=2 \
  script/run-test-question 10894 "tell me about climate mitigation in LA"
```

## Run A Batch

Start the API server separately:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8088
```

In another shell, run reviewed comment cases:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --comments-csv comments.csv \
  --org-data-dir org-data \
  --output tmp-reviewed-question-results.json
```

For transient upstream issues:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --comments-csv comments.csv \
  --org-data-dir org-data \
  --retries 2 \
  --retry-backoff 1 \
  --output tmp-reviewed-question-results.json
```

To inspect normalized payloads without calling the LLM:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --comments-csv comments.csv \
  --org-data-dir org-data \
  --dry-run-summary \
  --limit 5
```

## Focus A Subset

Run only a few cases:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --comments-csv comments.csv \
  --org-data-dir org-data \
  --limit 5
```

Filter by location text:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --comments-csv comments.csv \
  --org-data-dir org-data \
  --location-filter "Rio"
```

## Improving A Specific Result

Recommended loop:

1. Pick a reviewed case from `comments.csv`.
2. Run it with `script/run-test-question`.
3. Compare the answer with reviewer feedback.
4. Make the smallest targeted change.
5. Rerun the single question.
6. Rerun the batch or relevant filtered subset.
7. Run pytest.

Common fix locations:

- `ai-server/app/prompts/system_prompt.md`: user-facing behavior, refusal style, grounding rules, terminology.
- `ai-server/app/prompts/suggest_follow_ups.md`: follow-up selection behavior.
- `ai-server/app/prompts.py`: prompt loading and location-context formatting.
- `ai-server/app/follow_ups.py`: follow-up candidate selection and request shaping.
- `ai-server/utility_scripts/run_chat_eval.py`: batch case loading, retry behavior, normalized eval payloads.
- `ai-server/comments.csv`: reviewed question source.
- `ai-server/org-data`: endpoint-shaped reviewed location fixtures.

Local prompt files are re-read on each request, so edits to `app/prompts/system_prompt.md` should affect the next local API call without a server restart. Remote prompts loaded through the `SYSTEM_PROMPT` URL are cached for `SYSTEM_PROMPT_CACHE_SECONDS`.

## Automated Tests

Run all AI server tests:

```bash
uv run pytest
```

Relevant test files:

- `ai-server/tests/test_chatbot.py`: chat behavior and error mapping.
- `ai-server/tests/test_follow_ups.py`: follow-up selection.
- `ai-server/tests/test_openai_api.py`: OpenAI-compatible API contract.
- `ai-server/tests/test_prompts.py`: prompt loading and formatting.
- `ai-server/tests/test_run_chat_eval.py`: batch evaluation helper behavior.
