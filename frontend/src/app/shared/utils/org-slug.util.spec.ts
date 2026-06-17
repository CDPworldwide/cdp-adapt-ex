import {
  buildOrganizationSlugSegment,
  extractOrganizationIdFromRouteSegment,
  slugifyOrganizationText,
} from './org-slug.util';

describe('organization slug utilities', () => {
  it('normalizes organization text into lowercase hyphenated ASCII', () => {
    expect(slugifyOrganizationText('São Paulo & Region, BR')).toBe('sao-paulo-and-region-br');
  });

  it('builds stable ID-prefixed organization route segments', () => {
    expect(buildOrganizationSlugSegment(867355, 'London', 'United Kingdom')).toBe(
      '867355-london-united-kingdom',
    );
  });

  it('extracts the organization id from legacy numeric and readable segments', () => {
    expect(extractOrganizationIdFromRouteSegment('867355')).toBe('867355');
    expect(extractOrganizationIdFromRouteSegment('867355-london-united-kingdom')).toBe('867355');
    expect(extractOrganizationIdFromRouteSegment('london')).toBeNull();
  });
});
