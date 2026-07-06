import { countryCodeForName, countryFlagEmoji } from './country-flag.util';

describe('country flag utilities', () => {
  it('resolves common API country names to flag emojis', () => {
    expect(countryFlagEmoji('United States of America')).toBe('🇺🇸');
    expect(countryFlagEmoji('United Kingdom')).toBe('🇬🇧');
    expect(countryFlagEmoji('India')).toBe('🇮🇳');
  });

  it('normalizes punctuation and diacritics in country names', () => {
    expect(countryCodeForName("Côte d'Ivoire")).toBe('CI');
  });

  it('returns an empty flag for unknown country names', () => {
    expect(countryFlagEmoji('Atlantis')).toBe('');
  });
});
