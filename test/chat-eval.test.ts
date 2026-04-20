import { beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { OpenAiChatCompletionRequest } from '@pac-api/client';
import { createTestUser, type TestUser } from './helpers/auth';
import {
  loadCsvEvalCases,
  loadJsonEvalCases,
  normalizeLocationProfile,
  runChatEvalCases,
} from './helpers/chat-eval';
import { API_BASE_URL, setAuthToken, getApiOptions } from './setup';
import mumbaiEvalFixture from './fixtures/chat-eval-cases.json';
import jakartaEvalFixture from './fixtures/chat-eval-cases-jakarta.json';
import saoPauloEvalFixture from './fixtures/chat-eval-cases-sao-paulo.json';
import miamiEvalFixture from './fixtures/chat-eval-cases-miami.json';
import capeTownEvalFixture from './fixtures/chat-eval-cases-cape-town.json';
import hoChiMinhEvalFixture from './fixtures/chat-eval-cases-ho-chi-minh.json';
import phoenixEvalFixture from './fixtures/chat-eval-cases-phoenix.json';
import reykjavikEvalFixture from './fixtures/chat-eval-cases-reykjavik.json';
import rotterdamEvalFixture from './fixtures/chat-eval-cases-rotterdam.json';
import bangkokEvalFixture from './fixtures/chat-eval-cases-bangkok.json';

const DEFAULT_CHAT_EVAL_THRESHOLD = 1;

function getThreshold(envName: string): number {
  const raw = process.env[envName];
  if (!raw) {
    return DEFAULT_CHAT_EVAL_THRESHOLD;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${envName} must be a number between 0 and 1`);
  }

  return parsed;
}

function writeEvalSummary(results: Awaited<ReturnType<typeof runChatEvalCases>>) {
  const summaryPath = process.env.CHAT_EVAL_SUMMARY_PATH;
  if (!summaryPath) {
    return;
  }

  const recallValues = results
    .map((result) => result.score.recall)
    .filter((value): value is number => value !== null);
  const precisionValues = results
    .map((result) => result.score.precision)
    .filter((value): value is number => value !== null);
  const summaryDir = dirname(summaryPath);

  mkdirSync(summaryDir, { recursive: true });
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalCases: results.length,
        averageRecall:
          recallValues.length === 0
            ? null
            : recallValues.reduce((sum, value) => sum + value, 0) / recallValues.length,
        averagePrecision:
          precisionValues.length === 0
            ? null
            : precisionValues.reduce((sum, value) => sum + value, 0) / precisionValues.length,
        results,
      },
      null,
      2,
    ),
  );
}

describe('Chat evals', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(API_BASE_URL);
    if (testUser.token) {
      setAuthToken(testUser.token);
    }
  }, 30000);

  it('accepts locationData on the generated request type', () => {
    const request: OpenAiChatCompletionRequest = {
      messages: [{ role: 'user', content: 'What is Mumbai doing about heat?' }],
      locationData: normalizeLocationProfile(mumbaiEvalFixture.locationData, mumbaiEvalFixture.location),
    };

    expect(request.locationData?.countryName).toBe('India');
  });

  it('loads CSV-driven eval cases into location-aware requests', () => {
    const csvFixture = readFileSync(join(import.meta.dirname, 'fixtures', 'chat-eval-cases.csv'), 'utf-8');
    const cases = loadCsvEvalCases(csvFixture);

    expect(cases).toHaveLength(2);
    expect(cases[0].location).toBe('Mumbai, India');
    expect(cases[0].locationData.name).toBe('City of Mumbai');
    expect(cases[0].question).toContain('water demand');
    expect(cases[1].location).toBe('Jakarta, Indonesia');
    expect(cases[1].locationData.name).toBe('DKI Jakarta');
    expect(cases[1].expectedContains).toContain('Expand green open space coverage across the city');
  });

  describe('live eval execution', () => {
    it('answers the bundled location-grounded eval cases', async () => {
      const headers = getApiOptions().headers ?? {};
      const cases = [
        ...loadJsonEvalCases(mumbaiEvalFixture),
        ...loadJsonEvalCases(jakartaEvalFixture),
        ...loadJsonEvalCases(saoPauloEvalFixture),
        ...loadJsonEvalCases(miamiEvalFixture),
        ...loadJsonEvalCases(capeTownEvalFixture),
        ...loadJsonEvalCases(hoChiMinhEvalFixture),
        ...loadJsonEvalCases(phoenixEvalFixture),
        ...loadJsonEvalCases(reykjavikEvalFixture),
        ...loadJsonEvalCases(rotterdamEvalFixture),
        ...loadJsonEvalCases(bangkokEvalFixture),
      ];

      const results = await runChatEvalCases(API_BASE_URL, headers, cases);
      const recallThreshold = getThreshold('CHAT_EVAL_MIN_RECALL');
      const precisionThreshold = getThreshold('CHAT_EVAL_MIN_PRECISION');
      const recallValues = results
        .map((result) => result.score.recall)
        .filter((value): value is number => value !== null);
      const precisionValues = results
        .map((result) => result.score.precision)
        .filter((value): value is number => value !== null);

      writeEvalSummary(results);

      for (const result of results) {
        console.log(`\n[${result.id}]`);
        console.log(`Query: ${result.question}`);
        console.log(`LLM Output: ${result.answer}`);
        expect(result.answer.length, `${result.id} returned an empty answer`).toBeGreaterThan(0);
        expect(result.mentionsLocation, `${result.id} did not mention the selected location`).toBe(true);
        expect(result.score.missing, `${result.id} missing expected substrings`).toEqual([]);
        expect(result.score.unsupported, `${result.id} included unsupported substrings`).toEqual([]);
      }

      const averageRecall = recallValues.reduce((sum, value) => sum + value, 0) / recallValues.length;
      expect(averageRecall, 'Average chat eval recall fell below threshold').toBeGreaterThanOrEqual(
        recallThreshold,
      );

      if (precisionValues.length > 0) {
        const averagePrecision = precisionValues.reduce((sum, value) => sum + value, 0) / precisionValues.length;
        expect(
          averagePrecision,
          'Average chat eval precision fell below threshold',
        ).toBeGreaterThanOrEqual(precisionThreshold);
      }
    }, 900000);

  });
});
