import { environment } from '@env/environment';
import { createClient, createConfig } from '@pac-api/client/client';

function buildApiHeaders(): Record<string, string> | undefined {
  const apiKey = 'apiKey' in environment ? (environment.apiKey as string) : '';
  if (!apiKey) {
    return undefined;
  }

  const apiKeyHeaderName =
    'apiKeyHeaderName' in environment
      ? (environment.apiKeyHeaderName as string)
      : 'X-API-Key';

  return {
    [apiKeyHeaderName]: apiKey,
  };
}

export function createApiClient() {
  return createClient(
    createConfig({
      baseUrl: environment.baseUrl,
      headers: buildApiHeaders(),
    }),
  );
}
