import { environment } from '@env/environment';
import { createClient, createConfig } from '@pac-api/client/client';

function buildApiHeaders(): Record<string, string> | undefined {
  if (!environment.apiKey) {
    return undefined;
  }

  return {
    [environment.apiKeyHeaderName]: environment.apiKey,
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
