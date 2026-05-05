import { beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

if (existsSync('.env.local')) {
  process.loadEnvFile?.('.env.local');
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const API_KEY_HEADER_NAME = process.env.API_KEY_HEADER_NAME || 'X-API-Key';
const API_KEY = process.env.API_KEY || '';

let sessionToken: string | null = null;

beforeAll(() => {
  console.log(`\n🔧 Test setup: API Base URL = ${API_BASE_URL}\n`);
});

afterAll(() => {
  console.log('\n✅ Test teardown complete\n');
});

/**
 * Set authorization token for session-based auth
 */
export function setAuthToken(token: string) {
  sessionToken = token;
}

/**
 * Clear authorization token
 */
export function clearAuthToken() {
  sessionToken = null;
}

export function getRequestHeaders(includeAuth = true) {
  const headers: Record<string, string> = {};

  if (API_KEY) {
    headers[API_KEY_HEADER_NAME] = API_KEY;
  }

  if (includeAuth && sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  return headers;
}

/**
 * Get the common options (baseUrl + auth headers) for API calls
 */
export function getApiOptions(includeAuth = true) {
  return {
    baseUrl: API_BASE_URL,
    headers: getRequestHeaders(includeAuth),
  };
}

export { API_BASE_URL, API_KEY, API_KEY_HEADER_NAME };
