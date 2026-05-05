# Testing Reviewed Questions

This repo includes a repeatable workflow for testing reviewed Ask AI questions
against the local AI server. Use it when improving answer quality, grounding,
prompt behavior, or response reliability.

## Test Data

Reviewed questions live in:

```bash
data/questions.json
```

Each case includes:

- `id`: Stable case id.
- `orgId`: Account / organization id.
- `question`: User question to replay.
- `review`: Human reviewer feedback from `comments.csv`.
- `assertions`: Optional machine-checkable answer expectations, such as
  required wording and forbidden phrases.

The matching selected-location context lives in:

```bash
org-data/<orgId>.json
```

The raw `org-data` fixtures are intentionally left unchanged. Prompt-facing
context is cleaned at load time: geometry and internal ranking fields are
removed, provenance notes are added, and large peer-solution examples are
trimmed.

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

## Run The Batch

Start the API server separately, then run the batch eval:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8088
```

In another shell:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --output tmp-reviewed-question-results.json
```

For transient upstream issues:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --retries 2 \
  --retry-backoff 1 \
  --output tmp-reviewed-question-results.json
```

To make the command fail when reviewed-answer checks do not pass:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --retries 2 \
  --fail-on-checks \
  --output tmp-reviewed-question-results.json
```

To inspect the normalized payload without calling the LLM:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --dry-run \
  --limit 1
```

For normal debugging, prefer the compact payload summary:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --dry-run-summary \
  --limit 5
```

This prints case id, org id, payload size, context counts, and provenance notes
without dumping the full `locationData` JSON.

## Focus A Subset

Run only a few cases:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --limit 5
```

Filter by location text:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --location-filter "Rio"
```

## Improving A Specific Result

Recommended loop:

1. Pick a reviewed case from `data/questions.json`.
2. Run it with `script/run-test-question`.
3. Compare the answer with that case's `review` field.
4. Make the smallest targeted change.
5. Rerun the single question.
6. Rerun the batch or the relevant filtered subset.
7. Run pytest.

Common fix locations:

- [app/prompts/system_prompt.md](../app/prompts/system_prompt.md): user-facing
  behavior, refusal style, grounding rules, terminology.
- [app/prompts.py](../app/prompts.py): prompt loading, selected-location
  context sanitization, provenance notes, payload trimming.
- [utility_scripts/run_chat_eval.py](../utility_scripts/run_chat_eval.py):
  batch case loading, retry behavior, normalized eval payloads.
- [data/questions.json](../data/questions.json): stable regression questions.
- [org-data](../org-data): endpoint-shaped reviewed location fixtures.

Local prompt files are re-read on each request, so edits to
`app/prompts/system_prompt.md` should affect the next local API call without a
server restart. Remote prompts loaded through the `SYSTEM_PROMPT` URL remain
cached to avoid repeated network fetches.

Examples:

- If the model treats platform hazard ordering as an official ranking, update
  the ranking guidance in `system_prompt.md` or the context sanitization in
  `prompts.py`.
- If the model overstates GDP or population exposure, improve the aggregate
  statistics provenance wording.
- If answers are slow or `502` errors cluster around large locations, inspect
  `--dry-run` output and trim noisy prompt context in `prompts.py`.
- If a response is cut off, check max-token settings and retry behavior before
  changing answer content.

## Performance Checks

Use shell timing for quick comparisons:

```bash
time script/run-test-question 831391 "has the city ranked the hazards in their disclosure?"
```

For batch runs, compare:

- Number of successful cases.
- Repeated `502` failures after retries.
- Output length and whether answers are truncated.
- Whether dry-run payloads include unnecessary large fields.

Useful dry-run size check:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --dry-run \
  --limit 1 | wc -c
```

Useful compact context check:

```bash
uv run python utility_scripts/run_chat_eval.py \
  --questions-file data/questions.json \
  --dry-run-summary
```

## Automated Tests

Run all tests:

```bash
uv run pytest
```

Relevant test files:

- [tests/test_questions_data.py](../tests/test_questions_data.py): validates
  `data/questions.json` and org-data coverage.
- [tests/test_reviewed_chat_cases.py](../tests/test_reviewed_chat_cases.py):
  replays reviewed questions through the FastAPI endpoint with stubbed LLM
  output.
- [tests/test_run_chat_eval.py](../tests/test_run_chat_eval.py): covers batch
  loading, org-data resolution, retry behavior, and payload trimming.
- [tests/test_prompts.py](../tests/test_prompts.py): covers prompt guardrails,
  provenance notes, and selected-location context sanitization.
