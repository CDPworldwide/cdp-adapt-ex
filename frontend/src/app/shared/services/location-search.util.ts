import fuzzysort from 'fuzzysort';

import {
  COUNTRY_ALIASES,
  LOCATION_SEARCH_KEYWORDS,
  SEARCH_ALIASES,
} from '../../features/main-search/search-aliases';
import { STATE_ABBREV_TO_NAME } from '../../features/main-search/state-abbrev';
import { LocationSuggestion } from './location-suggestion';

export function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeLocationSearch(value: string): string {
  const base = stripDiacritics(value)
    .replace(/\bst\.?\b/gi, 'saint')
    .replace(/\bste\.?\b/gi, 'sainte')
    .replace(/\bmt\.?\b/gi, 'mount')
    .replace(/\bft\.?\b/gi, 'fort')
    .toLowerCase()
    .replace(/[.,()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return SEARCH_ALIASES[base] ?? COUNTRY_ALIASES[base] ?? base;
}

export function buildLocationSearchHaystack(name: string): string {
  const normalized = normalizeLocationSearch(name);
  const nameWithoutAdminCode = name.replace(/,\s*[A-Z]{2,3}\s*$/, '');
  const normalizedWithoutAdminCode =
    nameWithoutAdminCode === name ? undefined : normalizeLocationSearch(nameWithoutAdminCode);
  const abbreviationMatch = name.match(/,\s*([A-Z]{2,3})\s*$/);
  const expansion = abbreviationMatch ? STATE_ABBREV_TO_NAME[abbreviationMatch[1]] : undefined;
  const extra = LOCATION_SEARCH_KEYWORDS[normalized];

  return [
    normalized,
    normalizedWithoutAdminCode,
    expansion && normalizeLocationSearch(expansion),
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export function filterLocationSuggestions(
  value: string,
  locations: LocationSuggestion[],
  limit: number,
  fallbackSuggestions: LocationSuggestion[] = locations,
): LocationSuggestion[] {
  if (!value.trim()) {
    return fallbackSuggestions.slice(0, limit);
  }

  const normalizedQuery = normalizeLocationSearch(value);
  const prepared = locations.map((loc) => ({
    ...loc,
    _normalizedName: buildLocationSearchHaystack(loc.name),
    _normalizedCountry: loc.country ? normalizeLocationSearch(loc.country) : '',
  }));
  const directMatches = prepared.filter(
    (loc) =>
      loc._normalizedName === normalizedQuery ||
      loc._normalizedName.startsWith(`${normalizedQuery} `) ||
      loc._normalizedName.includes(` ${normalizedQuery} `) ||
      loc._normalizedCountry === normalizedQuery,
  );
  const results = fuzzysort.go(normalizedQuery, prepared, {
    keys: ['_normalizedName', '_normalizedCountry'],
    limit,
  });
  const mergedResults = [...directMatches, ...results.map((result) => result.obj)]
    .filter(
      (location, index, locationsWithDuplicates) =>
        locationsWithDuplicates.findIndex(
          (candidate) => candidate.organizationId === location.organizationId,
        ) === index,
    )
    .slice(0, limit);

  return mergedResults.map((result) => {
    const { _normalizedName, _normalizedCountry, ...rest } = result;
    return rest;
  });
}
