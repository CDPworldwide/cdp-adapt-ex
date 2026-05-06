import {
  chatCompletionsApiV1ChatsCompletionsPost,
  type LocationProfileInput,
  type OpenAiChatCompletionRequest,
} from '@pac-api/client';

const STATUS_MAP: Record<string, string> = {
  implementation: 'IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR',
  'in implementation': 'IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR',
  'in operation': 'ACTION_IN_OPERATION_JURISDICTION_WIDE',
  operational: 'ACTION_IN_OPERATION_JURISDICTION_WIDE',
  scoping: 'SCOPING',
  'pre-feasibility': 'PRE_FEASIBILITY',
  'pre feasibility': 'PRE_FEASIBILITY',
  'project feasibility': 'PROJECT_FEASIBILITY',
  'project structuring': 'PROJECT_STRUCTURING',
  'transaction preparation': 'TRANSACTION_PREPARATION',
  'post implementation': 'POST_IMPLEMENTATION',
};

const DEFAULT_REFUSAL_HINTS = [
  'available data',
  'provided data',
  'cannot',
  "can't",
  'only provide',
  'not authorized',
  'does not contain',
  'selected location data',
  'current data set',
  'do not have information',
  'only answer questions based on',
];

type JsonObject = Record<string, unknown>;
const MAX_CHAT_EVAL_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const LOCATION_CACHE = new Map<string, LocationProfileInput>();
let LOCATION_SUMMARIES_PROMISE: Promise<LocationSummary[]> | null = null;

interface LocationSummary {
  id: number;
  name: string;
  country: string;
}

export interface RawEvalCase {
  id?: string;
  location?: string;
  questionType?: string;
  question: string;
  expectedContains?: string[];
  unexpectedContains?: string[];
  refusalHints?: string[];
  locationTerms?: string[];
  locationData?: JsonObject;
}

export interface RawEvalFixture {
  location?: string;
  locationData?: JsonObject;
  cases: RawEvalCase[];
}

export interface CsvEvalRow {
  id?: string;
  questionType?: string;
  question?: string;
  location?: string;
  answer?: string;
  relevantData?: string;
}

export interface ChatEvalCase {
  id: string;
  location: string;
  questionType: string;
  question: string;
  expectedContains: string[];
  unexpectedContains: string[];
  refusalHints: string[];
  locationTerms: string[];
  locationData: LocationProfileInput;
}

export interface ChatEvalScore {
  passed: boolean | null;
  recall: number | null;
  precision: number | null;
  matched: string[];
  missing: string[];
  unsupported: string[];
}

export interface ChatEvalResult {
  id: string;
  location: string;
  question: string;
  answer: string;
  mentionsLocation: boolean;
  refusalHints: string[];
  score: ChatEvalScore;
}

async function resolveCanonicalLocationData(
  baseUrl: string,
  headers: Record<string, string>,
  testCase: ChatEvalCase,
): Promise<LocationProfileInput> {
  const organizationId = Number(testCase.locationData.organizationId ?? 0);
  if (organizationId > 0) {
    return testCase.locationData;
  }

  const cached = LOCATION_CACHE.get(testCase.location);
  if (cached) {
    return cached;
  }

  const [cityName, countryName] = splitLocation(testCase.location);
  const normalizedCity = normalizeLocationToken(cityName);
  const normalizedCountry = normalizeLocationToken(countryName);
  const summaries = await loadLocationSummaries(baseUrl, headers);
  const matchingSummary = summaries.find((summary) => {
    const summaryName = normalizeLocationToken(summary.name);
    const summaryCountry = normalizeLocationToken(summary.country);

    const cityMatches = summaryName.includes(normalizedCity) || normalizedCity.includes(summaryName);
    const countryMatches = summaryCountry.includes(normalizedCountry) || normalizedCountry.includes(summaryCountry);

    return cityMatches && countryMatches;
  });

  if (!matchingSummary) {
    throw new Error(`Failed to match canonical location data for ${testCase.location}`);
  }

  const response = await fetch(`${baseUrl}/api/v1/locations/id/${matchingSummary.id}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load canonical location data for ${testCase.location}: HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as { location?: LocationProfileInput };
  if (!payload.location) {
    throw new Error(`Location lookup for ${testCase.location} did not return a location payload`);
  }

  LOCATION_CACHE.set(testCase.location, payload.location);
  return payload.location;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeLooseText(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\r\n/g, '\n');
}

function normalizeLocationToken(value: string): string {
  return normalizeLooseText(value)
    .toLowerCase()
    .replace(/\b(city|municipality|municipalidad|metropolitan|government|prefeitura|district|council|regional|region|state|province|county|town|village|of|de|do|da|la|el)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadLocationSummaries(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<LocationSummary[]> {
  if (!LOCATION_SUMMARIES_PROMISE) {
    LOCATION_SUMMARIES_PROMISE = (async () => {
      const response = await fetch(`${baseUrl}/api/v1/locations/names`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to load location summaries: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        locations?: Array<{ id?: number; name?: string; country?: string }>;
      };

      return (payload.locations ?? []).filter(
        (location): location is LocationSummary => (
          typeof location.id === 'number'
          && typeof location.name === 'string'
          && typeof location.country === 'string'
        ),
      );
    })();
  }

  return LOCATION_SUMMARIES_PROMISE;
}

function buildLocationTerms(location: string, locationData: JsonObject, explicitTerms?: string[]): string[] {
  const [name, country] = splitLocation(location);
  return uniqueStrings([
    ...(explicitTerms ?? []),
    location,
    name,
    country,
    asString(locationData.name),
    asString(locationData.countryName),
  ]);
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function splitLocation(location: string): [string, string] {
  const parts = location.split(',', 2).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) {
    return [parts[0], parts[1]];
  }
  return [location.trim() || 'Unknown Location', 'Unknown Country'];
}

function coerceFloat(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function coerceInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numeric = Number.parseInt(String(value), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeHazardRef(item: unknown) {
  if (typeof item === 'string') {
    return { hazardType: item, otherHazardDetails: null };
  }

  const source = asObject(item);
  const hazard = asObject(source.hazard);
  const value = Object.keys(hazard).length > 0 ? hazard : source;

  return {
    hazardType: asString(value.hazardType, 'OTHERS'),
    otherHazardDetails:
      value.otherHazardDetails === undefined ? null : value.otherHazardDetails,
  };
}

function normalizeSector(item: unknown) {
  if (typeof item === 'string') {
    return { sectorType: item, otherSectorDetails: null };
  }

  const value = asObject(item);
  return {
    sectorType: asString(value.sectorType, 'OTHERS'),
    otherSectorDetails:
      value.otherSectorDetails === undefined ? null : value.otherSectorDetails,
  };
}

function normalizeStatistics(value: unknown) {
  const stats = asObject(value);
  return {
    populationExposedValue:
      stats.populationExposedValue === undefined ? null : stats.populationExposedValue,
    populationExposedPercentage:
      stats.populationExposedPercentage === undefined
        ? null
        : stats.populationExposedPercentage,
    gdpAtRiskValue: stats.gdpAtRiskValue === undefined ? null : stats.gdpAtRiskValue,
    gdpAtRiskPercentage:
      stats.gdpAtRiskPercentage === undefined ? null : stats.gdpAtRiskPercentage,
    gdpAtRiskCurrencyCode:
      stats.gdpAtRiskCurrencyCode === undefined ? null : stats.gdpAtRiskCurrencyCode,
    vulnerableSectors: asArray(stats.vulnerableSectors).map(normalizeSector),
  };
}

function normalizeHazardProfile(item: unknown, index: number) {
  const value = asObject(item);
  const hazard = Object.keys(asObject(value.hazard)).length > 0 ? value.hazard : value;

  return {
    hazard: normalizeHazardRef(hazard),
    hazardRank: coerceInt(value.hazardRank, index),
    source: value.source ?? null,
    description: value.description ?? null,
    vulnerableGroups: asArray(value.vulnerableGroups),
    proportionExposedRange:
      value.proportionExposedRange === undefined ? null : value.proportionExposedRange,
    impact: value.impact === undefined ? null : value.impact,
    mostExposedSectors: asArray(value.mostExposedSectors).map(normalizeSector),
  };
}

function normalizeActionStatus(item: unknown) {
  if (item === null || item === undefined || item === '') {
    return null;
  }

  if (typeof item === 'string') {
    const mapped = STATUS_MAP[item.trim().toLowerCase()];
    return {
      statusType: mapped ?? 'OTHERS',
      otherStatusDetails: mapped ? null : item,
    };
  }

  const value = asObject(item);
  const statusType = asString(value.statusType || value.status, 'OTHERS');
  return {
    statusType,
    otherStatusDetails:
      value.otherStatusDetails === undefined ? null : value.otherStatusDetails,
  };
}

function normalizeGoal(item: unknown, index: number) {
  const value = asObject(item);
  const description = asString(value.description);
  const title = asString(value.title, description || `Goal ${index}`);

  return {
    title,
    description: description || null,
    hazardsAddressed: asArray(value.hazardsAddressed).map(normalizeHazardRef),
    metricIndicator: value.metricIndicator ?? null,
    comment: value.comment ?? null,
    baseYear: value.baseYear ?? null,
    targetYear: value.targetYear ?? null,
  };
}

function normalizeAction(item: unknown, index: number) {
  const value = asObject(item);
  return {
    title: asString(value.title, `Action ${index}`),
    status: normalizeActionStatus(value.status),
    coBenefits: asArray(value.coBenefits),
    hazardsAddressed: asArray(value.hazardsAddressed).map(normalizeHazardRef),
    totalCostUsd: value.totalCostUsd ?? null,
    timeframe: value.timeframe ?? null,
    description: value.description ?? null,
    resilienceEnhanced: asArray(value.resilienceEnhanced),
    impactedSectors: asArray(value.impactedSectors).map(normalizeSector),
  };
}

function normalizeProject(item: unknown, index: number) {
  const value = asObject(item);
  const rawStatus = value.status;
  const status =
    typeof rawStatus === 'string'
      ? (() => {
          const normalized = rawStatus.trim();
          const lowered = normalized.toLowerCase();
          if (lowered === 'implementation') {
            return 'IMPLEMENTATION';
          }
          return STATUS_MAP[lowered] ?? normalized;
        })()
      : rawStatus ?? null;

  return {
    title: asString(value.title, `Project ${index}`),
    status,
    description: value.description ?? null,
    projectArea: value.projectArea ?? null,
    financeStatus: value.financeStatus ?? null,
    financeModel: value.financeModel ?? null,
    fundedPercent: value.fundedPercent ?? null,
    totalAmount: value.totalAmount ?? null,
    totalNeeded: value.totalNeeded ?? null,
  };
}

export function normalizeLocationProfile(
  data: JsonObject = {},
  fallbackLocation = '',
): LocationProfileInput {
  const [fallbackName, fallbackCountry] = splitLocation(fallbackLocation);
  const hazardsInputRaw = data.hazards;
  const hazardsInput = Array.isArray(hazardsInputRaw)
    ? { hazards: hazardsInputRaw }
    : asObject(hazardsInputRaw);

  const governmentInput =
    'goals' in data || 'actions' in data || 'projects' in data
      ? {
          goals: asArray(data.goals),
          actions: asArray(data.actions),
          projects: asArray(data.projects),
        }
      : asObject(data.governmentActions || data.government_actions);

  const solutions = asObject(data.solutions);

  return {
    organizationId: coerceInt(data.organizationId, 0),
    name: asString(data.name, fallbackName),
    countryName: asString(data.countryName, fallbackCountry),
    lat: coerceFloat(data.lat, 0),
    lng: coerceFloat(data.lng, 0),
    geometry: asObject(data.geometry),
    isReportingLeader: Boolean(data.isReportingLeader),
    hazards: {
      statistics: normalizeStatistics(hazardsInput.statistics),
      hazards: asArray(hazardsInput.hazards).map((item, index) =>
        normalizeHazardProfile(item, index + 1),
      ),
    },
    governmentActions: {
      goals: asArray(governmentInput.goals).map((item, index) =>
        normalizeGoal(item, index + 1),
      ),
      actions: asArray(governmentInput.actions).map((item, index) =>
        normalizeAction(item, index + 1),
      ),
      projects: asArray(governmentInput.projects).map((item, index) =>
        normalizeProject(item, index + 1),
      ),
    },
    solutions: {
      solutions: solutions && solutions.solutions && !Array.isArray(solutions.solutions)
        ? solutions.solutions
        : {},
    },
  } as LocationProfileInput;
}

export function loadJsonEvalCases(fixture: RawEvalFixture): ChatEvalCase[] {
  return fixture.cases.map((testCase, index) => ({
    id: testCase.id ?? `case-${index + 1}`,
    location: testCase.location ?? fixture.location ?? '',
    questionType: testCase.questionType ?? '',
    question: testCase.question,
    expectedContains: testCase.expectedContains ?? [],
    unexpectedContains: testCase.unexpectedContains ?? [],
    refusalHints: uniqueStrings([...DEFAULT_REFUSAL_HINTS, ...(testCase.refusalHints ?? [])]),
    locationTerms: buildLocationTerms(
      testCase.location ?? fixture.location ?? '',
      testCase.locationData ?? fixture.locationData ?? {},
      testCase.locationTerms,
    ),
    locationData: normalizeLocationProfile(
      testCase.locationData ?? fixture.locationData ?? {},
      testCase.location ?? fixture.location ?? '',
    ),
  }));
}

function parseCsvRecords(text: string): string[][] {
  const normalized = normalizeLooseText(text).trim();
  if (!normalized) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((record) => record.some((value) => value.trim() !== ''));
}

function normalizeCsvHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mapCsvRow(row: Record<string, string>): CsvEvalRow {
  const normalizedEntries = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeCsvHeader(key)] = value;
    return acc;
  }, {});

  return {
    id: normalizedEntries.id,
    questionType: normalizedEntries['question type'] ?? normalizedEntries.type,
    question: normalizedEntries.question,
    location: normalizedEntries.location,
    answer: normalizedEntries.answer ?? normalizedEntries.expected,
    relevantData:
      normalizedEntries['relevant data']
      ?? normalizedEntries['location data']
      ?? normalizedEntries.payload,
  };
}

function parseCsv(text: string): CsvEvalRow[] {
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return [];
  }

  const headers = records[0].map((header) => header.trim());

  return records.slice(1).map((cells) => {
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] ?? '';
      return acc;
    }, {});
    return mapCsvRow(row);
  });
}

function parseJsonish(text: string): JsonObject {
  const candidate = normalizeLooseText(text).trim().replace(/^"+|"+$/g, '');
  if (!candidate) {
    return {};
  }

  const compactCandidate = candidate.replace(/\n/g, ' ');
  const attempts = [candidate, compactCandidate];
  if (!candidate.startsWith('{')) {
    attempts.push(`{${candidate}}`);
    attempts.push(`{${compactCandidate}}`);
  }
  if (candidate.startsWith('"') && candidate.endsWith('"')) {
    attempts.push(candidate.slice(1, -1));
    attempts.push(`{${candidate.slice(1, -1)}}`);
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      return asObject(parsed);
    } catch {
      continue;
    }
  }

  throw new Error('Could not parse JSON-like content');
}

export function loadCsvEvalCases(csvText: string): ChatEvalCase[] {
  const rows = parseCsv(csvText);

  return rows.flatMap((row, index) => {
    const question = row.question?.trim() ?? '';
    const location = row.location?.trim() ?? '';
    const relevantDataRaw = row.relevantData?.trim() ?? '';

    if (!question || !location || !relevantDataRaw) {
      return [];
    }

    let locationDataRaw: JsonObject;
    try {
      locationDataRaw = parseJsonish(relevantDataRaw);
    } catch {
      return [];
    }

    return [{
      id: row.id?.trim() || `csv-${index + 1}`,
      location,
      questionType: row.questionType?.trim() ?? '',
      question,
      expectedContains: row.answer?.trim() ? [row.answer.trim()] : [],
      unexpectedContains: [],
      refusalHints: [],
      locationTerms: buildLocationTerms(location, locationDataRaw),
      locationData: normalizeLocationProfile(locationDataRaw, location),
    }];
  });
}

export function scoreCase(
  answer: string,
  expectedContains: string[],
  unexpectedContains: string[] = [],
): ChatEvalScore {
  if (expectedContains.length === 0) {
    const unsupported = unexpectedContains.filter((item) => matchesExpected(answer, item));
    return {
      passed: unsupported.length === 0 ? true : false,
      recall: null,
      precision: unexpectedContains.length === 0 ? null : Number(unsupported.length === 0),
      matched: [],
      missing: [],
      unsupported,
    };
  }

  const matched = expectedContains.filter((item) => matchesExpected(answer, item));
  const missing = expectedContains.filter((item) => !matchesExpected(answer, item));
  const unsupported = unexpectedContains.filter((item) => matchesExpected(answer, item));
  const recall = matched.length / expectedContains.length;
  const precision =
    unexpectedContains.length === 0 ? null : Number(unsupported.length === 0);

  return {
    passed: missing.length === 0 && unsupported.length === 0,
    recall,
    precision,
    matched,
    missing,
    unsupported,
  };
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/city's/g, 'city')
    .replace(/its/g, 'city')
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForMatch(value: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'of', 'to', 'is', 'for', 'that', 'through', 'and', 'up']);
  return normalizeForMatch(value)
    .split(' ')
    .filter((token) => token && !stopWords.has(token));
}

function matchesExpected(answer: string, expected: string): boolean {
  const normalizedAnswer = normalizeForMatch(answer);
  const normalizedExpected = normalizeForMatch(expected);

  if (normalizedAnswer.includes(normalizedExpected)) {
    return true;
  }

  const expectedTokens = tokenizeForMatch(expected);
  if (expectedTokens.length === 0) {
    return true;
  }

  const matchedTokens = expectedTokens.filter((token) => normalizedAnswer.includes(token));
  const numericTokens = expectedTokens.filter((token) => /\d|%/.test(token));
  const allNumericMatched = numericTokens.every((token) => normalizedAnswer.includes(token));

  return allNumericMatched && matchedTokens.length / expectedTokens.length >= 0.6;
}

export async function runChatEvalCase(
  baseUrl: string,
  headers: Record<string, string>,
  testCase: ChatEvalCase,
) : Promise<ChatEvalResult> {
  const locationData = await resolveCanonicalLocationData(baseUrl, headers, testCase);
  const body: OpenAiChatCompletionRequest = {
    messages: [{ role: 'user', content: testCase.question }],
    locationData,
  };

  for (let attempt = 1; attempt <= MAX_CHAT_EVAL_ATTEMPTS; attempt += 1) {
    try {
      const response = await chatCompletionsApiV1ChatsCompletionsPost({
        baseUrl,
        headers,
        body,
        throwOnError: false,
      });

      if (!response.error && response.data) {
        const answer = response.data.choices[0]?.message?.content?.trim() ?? '';
        const answerLower = answer.toLowerCase();
        const mentionsLocation = testCase.locationTerms.some((term) =>
          answerLower.includes(term.toLowerCase()),
        );

        return {
          id: testCase.id,
          location: testCase.location,
          question: testCase.question,
          answer,
          mentionsLocation,
          refusalHints: testCase.refusalHints,
          score: scoreCase(answer, testCase.expectedContains, testCase.unexpectedContains),
        };
      }

      const status = response.response?.status;
      const errorDetails = response.error
        ? JSON.stringify(response.error)
        : 'No response data returned';
      const shouldRetry = status !== undefined && RETRYABLE_STATUS_CODES.has(status);

      if (attempt < MAX_CHAT_EVAL_ATTEMPTS && shouldRetry) {
        await sleep(attempt * 1000);
        continue;
      }

      const failurePrefix = status
        ? `HTTP ${status}`
        : `No HTTP response from ${baseUrl}`;

      throw new Error(
        `Chat eval request failed for ${testCase.id}: ${failurePrefix}. ${errorDetails}`,
      );
    } catch (error) {
      if (attempt < MAX_CHAT_EVAL_ATTEMPTS) {
        await sleep(attempt * 1000);
        continue;
      }

      throw new Error(
        `Chat eval request failed for ${testCase.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(`Chat eval request exhausted retries for ${testCase.id}`);
}

export async function runChatEvalCases(
  baseUrl: string,
  headers: Record<string, string>,
  cases: ChatEvalCase[],
): Promise<ChatEvalResult[]> {
  const results: ChatEvalResult[] = [];

  for (const testCase of cases) {
    results.push(await runChatEvalCase(baseUrl, headers, testCase));
  }

  return results;
}
