import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MASTER_LOCALE = 'en';
const SAME_AS_MASTER_ALLOWED_KEYS = new Set([
  'shared.cdp',
  'homepage.welcomeModal.beta',
  'locationCard.hazardDetail.linkLabel',
  'learnMore.what.body',
  'learnMore.howToUse.body',
  'learnMore.faq.items.updates.answer',
  'learnMore.faq.items.coverage.answer',
  'learnMore.faq.items.use.answer',
]);
const DEFAULT_I18N_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'assets',
  'i18n',
);

function parseArgs(argv) {
  const args = {
    dir: DEFAULT_I18N_DIR,
    failOnMissing: false,
    failUnder: null,
    help: false,
    master: DEFAULT_MASTER_LOCALE,
    showKeys: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--dir') {
      args.dir = path.resolve(readRequiredValue(argv, index, arg));
      index += 1;
    } else if (arg === '--master') {
      args.master = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === '--show-keys') {
      args.showKeys = true;
    } else if (arg === '--fail-on-missing') {
      args.failOnMissing = true;
    } else if (arg === '--fail-under') {
      const value = Number(readRequiredValue(argv, index, arg));
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error('--fail-under must be a number from 0 to 100.');
      }
      args.failUnder = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument "${arg}". Run with --help for usage.`);
    }
  }

  return args;
}

function readRequiredValue(argv, index, arg) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${arg} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.log(`Check translation key coverage against a master locale.

Usage:
  node scripts/check-i18n-parity.mjs [options]

Options:
  --dir <path>          Directory containing locale JSON files.
                       Default: src/assets/i18n
  --master <locale>    Master locale filename without .json. Default: en
  --show-keys          Print missing, extra, and type-mismatched keys.
  --fail-on-missing    Exit with code 1 when any locale is below 100% coverage.
  --fail-under <pct>   Exit with code 1 when any locale coverage is below pct.
  -h, --help           Show this help.

Examples:
  npm run i18n:coverage
  npm run i18n:coverage -- --show-keys
  npm run i18n:coverage -- --fail-under 95
`);
}

async function readLocaleFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${filePath}: ${message}`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function flattenLeaves(value, prefix = '') {
  if (!isPlainObject(value)) {
    return new Map([[prefix, value]]);
  }

  const leaves = new Map();

  for (const [key, childValue] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    const childLeaves = flattenLeaves(childValue, childPrefix);

    for (const [childKey, leafValue] of childLeaves) {
      leaves.set(childKey, leafValue);
    }
  }

  return leaves;
}

function getValueAtPath(value, keyPath) {
  const segments = keyPath.split('.');
  let current = value;

  for (const segment of segments) {
    if (!isPlainObject(current) || !Object.hasOwn(current, segment)) {
      return { exists: false, value: undefined };
    }

    current = current[segment];
  }

  return { exists: true, value: current };
}

function valueKind(value) {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function isCoveredValue(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined;
}

function compareLocale(masterLeaves, masterLocale, locale, localeData) {
  const missing = [];
  const empty = [];
  const typeMismatches = [];
  const sameAsMaster = [];

  for (const [key, masterValue] of masterLeaves) {
    const localeResult = getValueAtPath(localeData, key);

    if (!localeResult.exists) {
      missing.push(key);
      continue;
    }

    if (valueKind(localeResult.value) !== valueKind(masterValue)) {
      typeMismatches.push(
        `${key} (${locale}: ${valueKind(localeResult.value)}, ${masterLocale}: ${valueKind(
          masterValue,
        )})`,
      );
      continue;
    }

    if (!isCoveredValue(localeResult.value)) {
      empty.push(key);
      continue;
    }

    if (
      locale !== masterLocale &&
      typeof localeResult.value === 'string' &&
      localeResult.value === masterValue &&
      !SAME_AS_MASTER_ALLOWED_KEYS.has(key)
    ) {
      sameAsMaster.push(key);
    }
  }

  const localeLeaves = flattenLeaves(localeData);
  const extra = [...localeLeaves.keys()].filter((key) => !masterLeaves.has(key));
  const covered =
    masterLeaves.size -
    missing.length -
    empty.length -
    typeMismatches.length -
    sameAsMaster.length;
  const coverage = masterLeaves.size === 0 ? 100 : (covered / masterLeaves.size) * 100;

  return {
    coverage,
    covered,
    empty,
    extra,
    missing,
    sameAsMaster,
    total: masterLeaves.size,
    typeMismatches,
  };
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function issueCount(result) {
  return (
    result.missing.length +
    result.empty.length +
    result.typeMismatches.length +
    result.sameAsMaster.length
  );
}

function needsTranslationCount(result) {
  return result.missing.length + result.empty.length + result.sameAsMaster.length;
}

function percentageOfTotal(count, total) {
  return total === 0 ? 0 : (count / total) * 100;
}

function printList(title, items) {
  if (items.length === 0) {
    return;
  }

  console.log(`\n${title}`);
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function printReport(results, { showKeys }) {
  console.log('\nTranslation coverage');
  console.log(
    'Locale  Coverage  Translated  Needs translation  Needs %  Missing keys  Empty  Same as master  Type  Issues  Extra',
  );
  console.log(
    '------  --------  ----------  -----------------  -------  ------------  -----  --------------  ----  ------  -----',
  );

  for (const [locale, result] of results) {
    const missingCount = result.missing.length;
    const emptyCount = result.empty.length;
    const typeMismatchCount = result.typeMismatches.length;
    const sameAsMasterCount = result.sameAsMaster.length;
    const needsTranslation = needsTranslationCount(result);
    const issues = issueCount(result);
    const row = [
      locale.padEnd(6),
      formatPercent(result.coverage).padStart(8),
      `${result.covered}/${result.total}`.padStart(7),
      String(needsTranslation).padStart(17),
      formatPercent(percentageOfTotal(needsTranslation, result.total)).padStart(7),
      String(missingCount).padStart(12),
      String(emptyCount).padStart(5),
      String(sameAsMasterCount).padStart(14),
      String(typeMismatchCount).padStart(4),
      String(issues).padStart(6),
      String(result.extra.length).padStart(5),
    ];
    console.log(row.join('  '));
  }

  const warningRows = [...results.entries()].filter(([, result]) => issueCount(result) > 0);
  if (warningRows.length > 0) {
    console.log('\nTranslation warnings');
    for (const [locale, result] of warningRows) {
      const missingCount = result.missing.length;
      const emptyCount = result.empty.length;
      const typeMismatchCount = result.typeMismatches.length;
      const sameAsMasterCount = result.sameAsMaster.length;
      const needsTranslation = needsTranslationCount(result);
      const issues = issueCount(result);
      console.log(
        `WARNING ${locale}: ${formatPercent(percentageOfTotal(needsTranslation, result.total))} ` +
          `needs translation (${needsTranslation}/${result.total}; ${missingCount} missing keys, ` +
          `${emptyCount} empty, ${sameAsMasterCount} same as master); ` +
          `${issues} total issues including ${typeMismatchCount} type mismatches`,
      );
    }
  } else {
    console.log('\nTranslation warnings');
    console.log('No missing, empty, or type-mismatched translation keys.');
  }

  if (!showKeys) {
    console.log('\nRun with --show-keys to print missing and extra translation keys.');
    return;
  }

  for (const [locale, result] of results) {
    console.log(`\n${locale}`);
    printList('Missing keys:', result.missing);
    printList('Empty keys:', result.empty);
    printList('Type mismatches:', result.typeMismatches);
    printList('Extra keys:', result.extra);
    printList('Same as master:', result.sameAsMaster);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const masterFile = path.join(args.dir, `${args.master}.json`);
  const masterData = await readLocaleFile(masterFile);
  const masterLeaves = flattenLeaves(masterData);
  const files = (await readdir(args.dir))
    .filter((file) => file.endsWith('.json'))
    .filter((file) => file !== `${args.master}.json`)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(`No locale JSON files found in ${args.dir} besides ${args.master}.json.`);
  }

  const results = new Map();

  for (const file of files) {
    const locale = path.basename(file, '.json');
    const localeData = await readLocaleFile(path.join(args.dir, file));
    results.set(locale, compareLocale(masterLeaves, args.master, locale, localeData));
  }

  console.log(`Master locale: ${args.master}.json`);
  console.log(`I18n directory: ${args.dir}`);
  console.log(`Master key count: ${masterLeaves.size}`);
  printReport(results, args);

  const failingLocales = [...results.entries()].filter(([, result]) => {
    if (args.failOnMissing && result.coverage < 100) {
      return true;
    }

    return args.failUnder !== null && result.coverage < args.failUnder;
  });

  if (failingLocales.length > 0) {
    const failures = failingLocales
      .map(([locale, result]) => `${locale} ${formatPercent(result.coverage)}`)
      .join(', ');
    throw new Error(`Translation coverage threshold failed: ${failures}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
