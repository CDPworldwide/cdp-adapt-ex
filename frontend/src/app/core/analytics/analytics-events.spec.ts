import type { LocationProfile } from '@pac-api/client';
import { locationProperties } from './analytics-events';

describe('analytics event properties', () => {
  it('includes population in location properties', () => {
    const location = {
      organizationId: 12345,
      name: 'Minas Gerais',
      countryName: 'Brazil',
      population: 53_000_000,
      publicStatus: 'Public',
      disclosureYear: 2025,
      hazards: { hazards: [{}, {}] },
      governmentActions: {
        actions: [{}],
        goals: [{}, {}, {}],
        projects: [{}],
      },
    } as LocationProfile;

    expect(locationProperties(location)).toEqual(
      jasmine.objectContaining({
        location_id: 12345,
        location_name: 'Minas Gerais',
        country: 'Brazil',
        population: 53_000_000,
        public_status: 'Public',
        disclosure_year: 2025,
        hazards_count: 2,
        actions_count: 1,
        goals_count: 3,
        projects_count: 1,
      }),
    );
  });
});
