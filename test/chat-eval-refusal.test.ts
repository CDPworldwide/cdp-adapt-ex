import { beforeAll, describe, expect, it } from 'vitest';
import { createTestUser, type TestUser } from './helpers/auth';
import { loadJsonEvalCases, runChatEvalCases } from './helpers/chat-eval';
import { API_BASE_URL, getApiOptions, setAuthToken } from './setup';
import refusalEvalFixture from './fixtures/chat-eval-cases-refusal.json';

describe('Chat eval refusals', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(API_BASE_URL);
    if (testUser.token) {
      setAuthToken(testUser.token);
    }
  }, 30000);

  it('refuses out-of-scope or advisory questions grounded only in available location data', async () => {
    const headers = getApiOptions().headers ?? {};
    const cases = loadJsonEvalCases(refusalEvalFixture);

    const results = await runChatEvalCases(API_BASE_URL, headers, cases);

    for (const result of results) {
      console.log(`\n[${result.id}]`);
      console.log(`Query: ${result.question}`);
      console.log(`LLM Output: ${result.answer}`);
      const answerLower = result.answer.toLowerCase();
      expect(result.answer.length, `${result.id} returned an empty answer`).toBeGreaterThan(0);
      expect(
        result.refusalHints.some((hint) => answerLower.includes(hint.toLowerCase())),
        `${result.id} did not clearly refuse or state scope limits`,
      ).toBe(true);
    }
  }, 300000);
});
