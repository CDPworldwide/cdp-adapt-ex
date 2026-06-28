const DEFAULT_BASE_URL = 'https://cdp-action-explorer.net';

const baseUrl = new URL(process.env.POSTHOG_SMOKE_BASE_URL || DEFAULT_BASE_URL);
const projectKey = process.env.FRONTEND_POSTHOG_KEY || process.env.POSTHOG_KEY;
const eventName = process.env.POSTHOG_SMOKE_EVENT_NAME || 'posthog_proxy_smoke_test';
const distinctId =
  process.env.POSTHOG_SMOKE_DISTINCT_ID || `posthog-proxy-smoke-${Date.now().toString(36)}`;

function endpoint(path) {
  return new URL(path, baseUrl).toString();
}

function maskKey(key) {
  return `${key.slice(0, 7)}...${key.slice(-6)}`;
}

async function getText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/javascript,text/plain,*/*',
      'User-Agent': 'cdp-posthog-proxy-smoke/1.0',
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  if (!body.trim()) {
    throw new Error(`${url} returned an empty body`);
  }

  return body;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'cdp-posthog-proxy-smoke/1.0',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body.slice(0, 200)}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${url} returned non-JSON response: ${body.slice(0, 200)}`);
  }
}

async function main() {
  if (!projectKey) {
    throw new Error(
      'Set FRONTEND_POSTHOG_KEY or POSTHOG_KEY before running the PostHog proxy smoke check.',
    );
  }

  console.log(`Checking PostHog proxy at ${baseUrl.origin} with key ${maskKey(projectKey)}`);

  const configUrl = endpoint(`/_cdp/array/${projectKey}/config.js`);
  const staticUrl = endpoint('/_cdp/static/array.js');
  const eventUrl = endpoint('/_cdp/e/');

  await getText(configUrl);
  console.log(`OK config route: ${configUrl}`);

  await getText(staticUrl);
  console.log(`OK static asset route: ${staticUrl}`);

  const result = await postJson(eventUrl, {
    api_key: projectKey,
    event: eventName,
    distinct_id: distinctId,
    properties: {
      source: 'frontend/scripts/check-posthog-proxy.mjs',
      checked_at: new Date().toISOString(),
      base_url: baseUrl.origin,
    },
  });

  if (result.status !== 'Ok') {
    throw new Error(`${eventUrl} returned unexpected payload: ${JSON.stringify(result)}`);
  }

  console.log(`OK event ingest: ${eventName} (${distinctId})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
