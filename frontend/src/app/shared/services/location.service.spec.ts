import { TestBed } from '@angular/core/testing';
import { LocationService, organizationIdFromRouteParam } from './location.service';
import type { LocationProfile } from '@pac-api/client';
import { LanguageService } from './language.service';

/**
 * LocationService Unit Tests
 *
 * Note: These tests verify the service structure and basic behavior.
 * The actual API calls are tested through integration tests since
 * the @pac-api/client uses ES modules that are difficult to mock.
 */
describe('LocationService', () => {
  let service: LocationService;

  const mockLocationData: LocationProfile = {
    organizationId: 12345,
    name: 'Minas Gerais',
    countryName: 'Brazil',
    lat: -17.9302,
    lng: -43.7908,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-17.9302, -43.7908]]],
    },
    isReportingLeader: true,
    hazards: {
      statistics: {
        populationExposedValue: 2400000,
        populationExposedPercentage: 11.4,
        gdpAtRiskValue: 225900000000,
        gdpAtRiskPercentage: 15.2,
        gdpAtRiskCurrencyCode: 'USD',
        vulnerableSectors: [],
      },
      hazards: [
        {
          hazard: {
            hazardType: 'Extreme heat' as any,
          },
          hazardRank: 1,
          source: 'CDP Climate Change 2023',
          description: 'Intensifying heatwaves...',
          vulnerableGroups: ['Women and girls'],
          proportionExposedRange: '11-20%',
          impact: 'Severe',
          mostExposedSectors: [],
        },
      ],
    },
    governmentActions: {
      goals: [],
      actions: [],
      projects: [],
    },
    solutions: {
      solutions: {},
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LocationService,
        {
          provide: LanguageService,
          useValue: {
            currentLang: () => 'en',
          },
        },
      ],
    });
    service = TestBed.inject(LocationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have getLocation method', () => {
    expect(service.getLocation).toBeDefined();
    expect(typeof service.getLocation).toBe('function');
  });

  it('should return an Observable from getLocation', () => {
    const result = service.getLocation('Test');
    expect(result).toBeDefined();
    expect(result.subscribe).toBeDefined();
  });

  it('should accept string parameter for location name', () => {
    expect(() => service.getLocation('Minas Gerais')).not.toThrow();
    expect(() => service.getLocation('São Paulo')).not.toThrow();
  });

  describe('getLocation error handling', () => {
    xit('should handle errors from API and log them', (done) => {
      spyOn(console, 'error');

      // Skipped: This test requires a real API endpoint which causes timeouts in CI.
      // Error handling is tested through integration tests.
      service.getLocation('NonexistentLocation').subscribe({
        next: () => {
          done();
        },
        error: (err) => {
          expect(err).toBeDefined();
          expect(console.error).toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('LocationProfile type', () => {
    it('should work with LocationProfile interface', () => {
      expect(mockLocationData.name).toBeDefined();
      expect(mockLocationData.lat).toBeDefined();
      expect(mockLocationData.hazards).toBeDefined();

      expect(typeof mockLocationData.name).toBe('string');
      expect(typeof mockLocationData.lat).toBe('number');
      expect(typeof mockLocationData.hazards).toBe('object');
    });
  });
});

describe('organizationIdFromRouteParam', () => {
  it('should parse numeric organization route params', () => {
    expect(organizationIdFromRouteParam('3203')).toBe(3203);
  });

  it('should parse slugged organization route params generated for links', () => {
    expect(organizationIdFromRouteParam('3203-city-of-chicago-united-states-of-america')).toBe(
      3203,
    );
  });

  it('should reject route params without a numeric organization id prefix', () => {
    expect(() => organizationIdFromRouteParam('city-of-chicago')).toThrowError(
      /Invalid organization id route parameter/,
    );
  });
});
