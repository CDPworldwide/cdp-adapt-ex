const ISO_ALPHA_2_START = 'A'.charCodeAt(0);
const ISO_ALPHA_2_END = 'Z'.charCodeAt(0);
const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - ISO_ALPHA_2_START;

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  bolivia: 'BO',
  'bolivia plurinational state of': 'BO',
  brunei: 'BN',
  'brunei darussalam': 'BN',
  'cabo verde': 'CV',
  'cape verde': 'CV',
  'cote d ivoire': 'CI',
  'cote divoire': 'CI',
  czechia: 'CZ',
  'czech republic': 'CZ',
  'democratic republic of the congo': 'CD',
  'iran islamic republic of': 'IR',
  iran: 'IR',
  kosovo: 'XK',
  laos: 'LA',
  'lao people s democratic republic': 'LA',
  moldova: 'MD',
  'moldova republic of': 'MD',
  palestine: 'PS',
  'palestine state of': 'PS',
  russia: 'RU',
  'russian federation': 'RU',
  'south korea': 'KR',
  'republic of korea': 'KR',
  syria: 'SY',
  'syrian arab republic': 'SY',
  tanzania: 'TZ',
  'tanzania united republic of': 'TZ',
  turkey: 'TR',
  turkiye: 'TR',
  'united kingdom': 'GB',
  uk: 'GB',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  venezuela: 'VE',
  'venezuela bolivarian republic of': 'VE',
  vietnam: 'VN',
  'viet nam': 'VN',
};

let countryCodeLookup: Map<string, string> | null = null;

export function countryFlagEmoji(countryName: string | null | undefined): string {
  const countryCode = countryCodeForName(countryName);
  return countryCode ? flagEmojiForCountryCode(countryCode) : '';
}

export function countryFlagImageUrl(countryName: string | null | undefined): string {
  const countryCode = countryCodeForName(countryName);
  return countryCode ? `https://flagcdn.com/${countryCode.toLowerCase()}.svg` : '';
}

export function countryCodeForName(countryName: string | null | undefined): string | null {
  const normalizedCountryName = normalizeCountryName(countryName);
  if (!normalizedCountryName) {
    return null;
  }

  return (
    COUNTRY_CODE_ALIASES[normalizedCountryName] ??
    getCountryCodeLookup().get(normalizedCountryName) ??
    null
  );
}

function getCountryCodeLookup(): Map<string, string> {
  if (countryCodeLookup) {
    return countryCodeLookup;
  }

  countryCodeLookup = new Map<string, string>();

  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames === 'undefined') {
    return countryCodeLookup;
  }

  const regionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });

  for (let first = ISO_ALPHA_2_START; first <= ISO_ALPHA_2_END; first += 1) {
    for (let second = ISO_ALPHA_2_START; second <= ISO_ALPHA_2_END; second += 1) {
      const countryCode = `${String.fromCharCode(first)}${String.fromCharCode(second)}`;
      const displayName = regionDisplayNames.of(countryCode);
      const normalizedDisplayName = normalizeCountryName(displayName);

      if (!normalizedDisplayName || normalizedDisplayName === countryCode.toLowerCase()) {
        continue;
      }

      countryCodeLookup.set(normalizedDisplayName, countryCode);
    }
  }

  return countryCodeLookup;
}

function flagEmojiForCountryCode(countryCode: string): string {
  if (countryCode.length !== 2) {
    return '';
  }

  return Array.from(countryCode.toUpperCase())
    .map((letter) => String.fromCodePoint(letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET))
    .join('');
}

function normalizeCountryName(countryName: string | null | undefined): string {
  return (countryName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
