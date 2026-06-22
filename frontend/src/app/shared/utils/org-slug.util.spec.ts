import { buildOrganizationSlugSegment } from './org-slug.util';

describe('buildOrganizationSlugSegment', () => {
  it('builds the organization route segment used by location pages', () => {
    expect(
      buildOrganizationSlugSegment(3417, 'New York City, NY', 'United States of America'),
    ).toBe('3417-new-york-city-ny-united-states-of-america');
    expect(buildOrganizationSlugSegment(3203, 'City of Chicago', 'United States of America')).toBe(
      '3203-city-of-chicago-united-states-of-america',
    );
  });
});
