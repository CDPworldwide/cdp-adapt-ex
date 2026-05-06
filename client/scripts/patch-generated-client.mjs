import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.dirname(__dirname);

const indexPath = path.join(clientDir, 'src', 'index.ts');
const typesPath = path.join(clientDir, 'src', 'types.gen.ts');

const aliasExportLine =
  "export { type ActionsTabOutput as ActionsTab, type AdaptationActionOutput as AdaptationAction, type AdaptationGoalOutput as AdaptationGoal, type HazardProfileOutput as HazardProfile, type LocationProfileOutput as LocationProfile, type ProjectSeekingFundingOutput as ProjectSeekingFunding } from './types.gen.js';\n";
const aliasHeader =
  '// Backward-compatible aliases keep existing frontend consumers stable while the\n// generated client adopts explicit Input/Output model names.\n';
const legacyTypeNames = [
  'ActionsTab',
  'AdaptationAction',
  'AdaptationGoal',
  'HazardProfile',
  'LocationProfile',
  'ProjectSeekingFunding',
];

function hasPlainLegacyTypes(typesSource) {
  return legacyTypeNames.every((name) =>
    typesSource.includes(`export type ${name} =`)
  );
}

function hasOutputLegacyTypes(typesSource) {
  return legacyTypeNames.every((name) =>
    typesSource.includes(`export type ${name}Output =`)
  );
}

async function patchIndex(typesSource) {
  const indexSource = await readFile(indexPath, 'utf8');
  const cleanedSource = indexSource.replace(aliasExportLine, '');

  if (hasPlainLegacyTypes(typesSource) || !hasOutputLegacyTypes(typesSource)) {
    if (cleanedSource !== indexSource) {
      await writeFile(indexPath, cleanedSource);
    }
    return;
  }

  if (cleanedSource.includes(aliasExportLine.trim())) {
    return;
  }

  const sdkExportMatch = cleanedSource.match(/^export \{.*\} from '\.\/sdk\.gen\.js';\n/m);

  if (!sdkExportMatch) {
    throw new Error('Could not find generated SDK export line in client/src/index.ts');
  }

  const patchedSource = cleanedSource.replace(sdkExportMatch[0], `${sdkExportMatch[0]}${aliasExportLine}`);
  await writeFile(indexPath, patchedSource);
}

async function patchTypes() {
  const typesSource = await readFile(typesPath, 'utf8');
  const aliasStart = typesSource.indexOf(aliasHeader);
  const patchedSource = aliasStart >= 0 ? typesSource.slice(0, aliasStart).trimEnd() + '\n' : typesSource;
  await writeFile(typesPath, patchedSource);

  return patchedSource;
}

const patchedTypesSource = await patchTypes();
await patchIndex(patchedTypesSource);
