const UNITED_STATES_COUNTRY = 'United States of America';

const US_STATE_NAMES = new Set([
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming',
  'district of columbia',
  'puerto rico',
]);

const US_POSTAL_ABBREVIATIONS = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
  'PR',
]);

export function inferLocationCountry(
  locationName: string | null | undefined,
  country: string | null | undefined,
): string | undefined {
  const trimmedCountry = country?.trim();
  if (trimmedCountry) {
    return trimmedCountry;
  }

  if (isUnitedStatesLocationName(locationName)) {
    return UNITED_STATES_COUNTRY;
  }

  return undefined;
}

function isUnitedStatesLocationName(locationName: string | null | undefined): boolean {
  const trimmedName = locationName?.trim();
  if (!trimmedName) {
    return false;
  }

  const postalAbbreviation = trimmedName.match(/,\s*([A-Z]{2})\b/)?.[1];
  if (postalAbbreviation && US_POSTAL_ABBREVIATIONS.has(postalAbbreviation)) {
    return true;
  }

  const normalizedName = normalizeLocationName(trimmedName).replace(
    /^(state|commonwealth|territory) of /,
    '',
  );

  return US_STATE_NAMES.has(normalizedName);
}

function normalizeLocationName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
