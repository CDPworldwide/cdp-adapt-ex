import { beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

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

export { API_BASE_URL };
