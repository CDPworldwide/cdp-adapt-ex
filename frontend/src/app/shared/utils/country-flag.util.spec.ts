import { countryCodeForName, countryFlagEmoji, countryFlagImageUrl } from './country-flag.util';

describe('country flag utilities', () => {
  it('resolves common API country names to flag emojis', () => {
    expect(countryFlagEmoji('United States of America')).toBe('🇺🇸');
    expect(countryFlagEmoji('United Kingdom')).toBe('🇬🇧');
    expect(countryFlagEmoji('India')).toBe('🇮🇳');
  });

  it('builds image URLs for country flags', () => {
    expect(countryFlagImageUrl('United States of America')).toBe('https://flagcdn.com/us.svg');
    expect(countryFlagImageUrl('United Kingdom')).toBe('https://flagcdn.com/gb.svg');
    expect(countryFlagImageUrl('India')).toBe('https://flagcdn.com/in.svg');
  });

  it('normalizes punctuation and diacritics in country names', () => {
    expect(countryCodeForName("Côte d'Ivoire")).toBe('CI');
  });

  it('returns an empty flag for unknown country names', () => {
    expect(countryFlagEmoji('Atlantis')).toBe('');
    expect(countryFlagImageUrl('Atlantis')).toBe('');
  });
});
