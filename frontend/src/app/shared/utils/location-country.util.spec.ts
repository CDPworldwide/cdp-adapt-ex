import { inferLocationCountry } from './location-country.util';

describe('location country utilities', () => {
  it('keeps countries supplied by the API', () => {
    expect(inferLocationCountry('State of Kentucky', 'United States')).toBe('United States');
  });

  it('infers the country for US state organization names without countries', () => {
    expect(inferLocationCountry('State of Kentucky', '')).toBe('United States of America');
    expect(inferLocationCountry('Commonwealth of Massachusetts', null)).toBe(
      'United States of America',
    );
  });

  it('infers the country from US postal abbreviations in location names', () => {
    expect(inferLocationCountry('City of Louisville, KY', undefined)).toBe(
      'United States of America',
    );
    expect(inferLocationCountry('Santa Fe County, NM', '')).toBe('United States of America');
  });

  it('does not infer countries for unmatched location names', () => {
    expect(inferLocationCountry('Chengdu Municipal Government', '')).toBeUndefined();
  });
});
