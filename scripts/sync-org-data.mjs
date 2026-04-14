import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getLocationByOrgIdApiV1LocationIdOrganizationIdGet } from '../client/dist/index.js';
import { createClient, createConfig } from '../client/dist/client/index.js';

const DEFAULT_ORG_IDS = ['3203'];
const BASE_URL = process.env.PAC_API_BASE_URL ?? process.env.API_URL ?? 'http://127.0.0.1:4352';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'data', 'org-data');

function parseOrgIds(argv) {
  const orgIds = argv.length > 0 ? argv : DEFAULT_ORG_IDS;

  for (const orgId of orgIds) {
    if (!/^\d+$/.test(orgId)) {
      throw new Error(`Invalid organization id "${orgId}". Expected a numeric id.`);
    }
  }

  return orgIds;
}

async function fetchLocationByOrgId(client, organizationId) {
  const response = await getLocationByOrgIdApiV1LocationIdOrganizationIdGet({
    client,
    path: { organization_id: Number(organizationId) },
  });

  if (response.error || !response.data) {
    const detail =
      typeof response.error === 'string'
        ? response.error
        : JSON.stringify(response.error ?? { message: 'Unknown error' });

    throw new Error(`Failed to fetch org ${organizationId}: ${detail}`);
  }

  return response.data;
}

function stripGeometry(location) {
  const { geometry: _geometry, ...locationWithoutGeometry } = location;
  return locationWithoutGeometry;
}

async function main() {
  const organizationIds = parseOrgIds(process.argv.slice(2));
  const client = createClient(
    createConfig({
      baseUrl: BASE_URL,
    }),
  );
  await mkdir(outputDir, { recursive: true });

  for (const organizationId of organizationIds) {
    const location = await fetchLocationByOrgId(client, organizationId);
    const sanitizedLocation = stripGeometry(location);
    const outputPath = path.join(outputDir, `${organizationId}.json`);

    await writeFile(outputPath, `${JSON.stringify(sanitizedLocation, null, 2)}\n`, 'utf8');
    console.log(`Synced org ${organizationId}: ${location.name} -> ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
