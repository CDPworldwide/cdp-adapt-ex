# CDP Adaptation & Action Explorer Integration Tests

This directory contains integration tests for the CDP Adaptation & Action Explorer using Vitest.

## Prerequisites

### Backend Chat Setup

The chat integration tests target the currently mounted `/api/v1/chat/completions` routes directly. They no longer depend on `/api/v1/auth/session`, which is not mounted in the active backend router.

## Setup

1. Ensure the backend is running locally and can reach the configured LLM provider

2. Install dependencies:
```bash
cd test
npm install
```

3. Create a `.env` file (optional, use `.env.example` as template):
```bash
API_BASE_URL=http://localhost:8000
TEST_USER_EMAIL=testuser@example.com
TEST_USER_PASSWORD=TestUser123!
```

## Running Tests

Make sure the API is running (default port is `4352` if started via root `npm run dev:backend`, or `8000` if started directly via FastAPI).

Run all tests:
```bash
npm test
```

Run tests once:
```bash
npm run test:run
```

Run the location-grounded chat eval suite:
```bash
npm run test:chat-eval
```

Run the CI-friendly chat eval command:
```bash
npm run test:chat-eval:ci
```

Run the chat evals and persist a JSON summary for review or CI artifacts:
```bash
npm run test:chat-eval:report
```

Watch mode:
```bash
npm run test:watch
```

With UI:
```bash
npm run test:ui
```

With coverage:
```bash
npm run test:coverage
```

## Authentication in Tests

### How Test Headers Work

1. Tests can still send a bearer token when `TEST_AUTH_TOKEN` is set, but chat route coverage no longer depends on session creation
2. The manual streaming checks use the same shared headers as the generated client

### Test Helper Functions

Located in `helpers/auth.ts`:

- **`createTestUser(baseUrl)`**: Returns test user credentials for optional bearer auth
- **`registerUser(baseUrl, email, password)`**: Registers a new user when auth routes are available
- **`loginUser(baseUrl, email, password)`**: Logs in and returns an access token when auth routes are available

### Example Test Usage

```typescript
import { createTestUser } from './helpers/auth';
import { chatCompletionsApiV1ChatCompletionsPost } from '@pac-api/client';

describe('Chatbot API', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(API_BASE_URL);
  });

  it('should return a chat response', async () => {
    const response = await chatCompletionsApiV1ChatCompletionsPost({
      baseUrl: API_BASE_URL,
      body: { messages: [{ role: 'user', content: 'Hello' }] },
      headers: {
        'Authorization': `Bearer ${testUser.token}`,
      },
    });

    expect(response.error).toBeUndefined();
  });
});
```

## Environment Variables

- `API_BASE_URL`: Base URL for the API (default: `http://localhost:8000`)
- `TEST_AUTH_TOKEN`: Optional bearer token for environments where chat auth is enabled
- `TEST_USER_EMAIL`: Test user email (default: `test-user@example.com`)
- `TEST_USER_PASSWORD`: Test user password (default: `TestUser123!`)
- `CHAT_EVAL_MIN_RECALL`: Minimum average recall required for the location-grounded eval suite (default: `1`)
- `CHAT_EVAL_MIN_PRECISION`: Minimum average precision required for any eval cases that define unsupported snippets (default: `1`)
- `CHAT_EVAL_SUMMARY_PATH`: Optional path for a JSON summary of the latest chat eval run

## Chat Eval Suite Notes

- The JSON fixtures in `test/fixtures/` are a starter regression suite, not a finished ceiling; add more cities and edge cases over time as prompt behavior evolves.
- CI should run `npm run test:chat-eval:ci` against the PR preview backend so prompt regressions are caught before merge.
- The current pass/fail threshold is driven by `CHAT_EVAL_MIN_RECALL` and `CHAT_EVAL_MIN_PRECISION`, which default to `1` for fully passing suites.
- When `CHAT_EVAL_SUMMARY_PATH` is set, the suite writes a machine-readable summary that can be uploaded as a CI artifact for trend tracking.

## Test Structure

- `chatbot.test.ts`: Tests for the chatbot endpoint
- `chat-eval.test.ts`: Location-grounded chat evals using the generated TypeScript client
- `fixtures/`: Test data and mock responses
  - `chat-requests.json`: Sample chat request payloads
  - `chat-eval-cases.json`: Mumbai location-grounded eval fixture data
  - `chat-eval-cases-jakarta.json`: Jakarta location-grounded eval fixture data
  - `chat-eval-cases-sao-paulo.json`: Sao Paulo location-grounded eval fixture data
  - `chat-eval-cases-miami.json`: Miami location-grounded eval fixture data
  - `chat-eval-cases-cape-town.json`: Cape Town location-grounded eval fixture data
  - `chat-eval-cases-ho-chi-minh.json`: Ho Chi Minh City location-grounded eval fixture data
  - `chat-eval-cases-phoenix.json`: Phoenix location-grounded eval fixture data
  - `chat-eval-cases-reykjavik.json`: Reykjavik location-grounded eval fixture data
  - `chat-eval-cases-rotterdam.json`: Rotterdam location-grounded eval fixture data
  - `chat-eval-cases-bangkok.json`: Bangkok location-grounded eval fixture data
  - `chat-eval-cases-refusal.json`: Out-of-scope and advisory refusal eval fixture data
  - `chat-eval-cases.csv`: CSV fixture for messy export parsing coverage
- `helpers/`: Utility functions for tests
  - `auth.ts`: Authentication helpers (register, login, create test users)
  - `chat-eval.ts`: Eval case normalization, CSV parsing, request execution, and scoring helpers
  - `setup.ts`: Global test setup and configuration

## Troubleshooting

### Tests Fail with 401 Unauthorized

**Problem:** Tests are getting 401 errors from chat endpoints.

**Solution:** Verify that:
1. The backend currently expects chat auth in your environment
2. `TEST_AUTH_TOKEN` is set to a valid bearer token
3. `API_BASE_URL` points at the backend instance you expect

### Tests Timeout or Hang

**Problem:** Tests are not completing and timing out.

**Solution:**
1. Ensure the backend API is running on the correct port
2. Check that `API_BASE_URL` matches where your API is running
 3. Verify the backend is healthy: `curl http://localhost:8000/api/v1/health`

## Best Practices

1. Tests use the generated TypeScript client from `@pac-api/client`
2. Live eval cases run sequentially to reduce flaky LLM transport failures
3. Use test fixtures for consistent request payloads
4. Mock external dependencies (LLM calls, external APIs) where appropriate
5. Never commit real credentials or tokens to the repository

## Security Notes

- Test users are created with known credentials - these should not be used for real data
- Always use different credentials for production vs test environments
