import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.dirname(__dirname);

const indexPath = path.join(clientDir, 'src', 'index.ts');
const typesPath = path.join(clientDir, 'src', 'types.gen.ts');

const aliasExportLine = "export { type ActionsTab, type AdaptationAction, type AdaptationGoal, type HazardProfile, type LocationProfile, type ProjectSeekingFunding } from './types.gen.js';\n";
const aliasBlock = "\n// Backward-compatible aliases keep existing frontend consumers stable while the\n// generated client adopts explicit Input/Output model names.\nexport type ActionsTab = ActionsTabOutput;\nexport type AdaptationAction = AdaptationActionOutput;\nexport type AdaptationGoal = AdaptationGoalOutput;\nexport type HazardProfile = HazardProfileOutput;\nexport type LocationProfile = LocationProfileOutput;\nexport type ProjectSeekingFunding = ProjectSeekingFundingOutput;\n";

async function patchIndex() {
  const indexSource = await readFile(indexPath, 'utf8');

  if (indexSource.includes(aliasExportLine.trim())) {
    return;
  }

  const sdkExportMatch = indexSource.match(/^export \{.*\} from '\.\/sdk\.gen\.js';\n/m);

  if (!sdkExportMatch) {
    throw new Error('Could not find generated SDK export line in client/src/index.ts');
  }

  const patchedSource = indexSource.replace(sdkExportMatch[0], `${sdkExportMatch[0]}${aliasExportLine}`);
  await writeFile(indexPath, patchedSource);
}

async function patchTypes() {
  const typesSource = await readFile(typesPath, 'utf8');

  if (typesSource.includes('export type ActionsTab = ActionsTabOutput;')) {
    return;
  }

  await writeFile(typesPath, `${typesSource}${aliasBlock}`);
}

await patchIndex();
await patchTypes();
