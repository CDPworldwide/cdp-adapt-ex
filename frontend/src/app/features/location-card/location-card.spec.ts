import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LocationCardComponent, type LocationCardTabKey } from './location-card';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import type { LocationProfile } from '@pac-api/client';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { GeometryService } from '../../shared/services/geometry.service';
import { of } from 'rxjs';

describe('LocationCardComponent', () => {
  let component: LocationCardComponent;
  let fixture: ComponentFixture<LocationCardComponent>;
  let geometryServiceSpy: jasmine.SpyObj<GeometryService>;

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
    disclosureYear: 2025,
    requesters: ['C40 Cities', 'WWF'],
    population: 53000000,
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
            hazardType: 'EXTREME_HEAT' as any,
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
      actions: [
        {
          title: 'Action 1',
          hazardsAddressed: [
            { hazardType: 'EXTREME_HEAT' as any },
            { hazardType: 'DROUGHT' as any },
          ],
        },
        {
          title: 'Action 2',
          hazardsAddressed: [{ hazardType: 'EXTREME_HEAT' as any }],
        },
      ],
      projects: [],
    },
    solutions: {
      solutions: {},
    },
  };

  beforeEach(async () => {
    // Mock google maps for the test
    (window as any).google = {
      maps: {
        LatLngBounds: class {
          isEmpty = () => false;
        },
      },
    };

    const geoSpy = jasmine.createSpyObj('GeometryService', ['calculateBounds']);
    geoSpy.calculateBounds.and.returnValue(of(new (window as any).google.maps.LatLngBounds()));

    await TestBed.configureTestingModule({
      imports: [LocationCardComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GeometryService, useValue: geoSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationCardComponent);
    component = fixture.componentInstance;
    geometryServiceSpy = TestBed.inject(GeometryService) as jasmine.SpyObj<GeometryService>;

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      locationCard: {
        backToMap: 'Back to map',
        header: {
          estimatedPopulation: 'Estimated population:',
          populationTooltip: "Population estimates from {{location}}'s CDP disclosure",
        },
        hazardNames: {
          EXTREME_HEAT: 'Extreme Heat',
          DROUGHT: 'Drought',
        },
      },
    });
    translateService.use('en');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate jurisdiction bounds when data changes', fakeAsync(() => {
    fixture.detectChanges(); // Initialize ngOnInit and setup stream

    component.data = { ...mockLocationData };
    // Trigger ngOnChanges
    component.ngOnChanges({
      data: {
        currentValue: component.data,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    tick(); // Wait for ReplaySubject and switchMap

    expect(geometryServiceSpy.calculateBounds).toHaveBeenCalledWith(mockLocationData.geometry);
    expect(component.jurisdictionBounds).toBeDefined();
  }));

  it('should clear jurisdiction bounds when data has no geometry', fakeAsync(() => {
    fixture.detectChanges(); // Initialize ngOnInit and setup stream

    const dataNoGeo = { ...mockLocationData } as any;
    delete dataNoGeo.geometry;
    component.data = dataNoGeo;
    component.ngOnChanges({
      data: {
        currentValue: dataNoGeo,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    tick();
    expect(component.jurisdictionBounds).toBeUndefined();
  }));

  describe('Header Population', () => {
    it('should show formatted population in header', () => {
      component.data = { ...mockLocationData, population: 53000000 };
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('.flex-col');
      // Using a regex to handle potential whitespace differences between nested divs
      expect(header.textContent).toMatch(/Estimated population:\s*~\s*53 million/);

      const tooltipIcon = fixture.nativeElement.querySelector('.flex-col app-info-icon');
      expect(tooltipIcon).toBeTruthy();
    });

    it('should format population in thousands correctly', () => {
      component.data = { ...mockLocationData, population: 53200 };
      fixture.detectChanges();

      const header = fixture.nativeElement.querySelector('.flex-col');
      expect(header.textContent).toMatch(/Estimated population:\s*~\s*53k/);
    });

    it('should not show population when not provided', () => {
      component.data = { ...mockLocationData, population: undefined };
      fixture.detectChanges();

      const populationText = fixture.nativeElement.textContent;
      expect(populationText).not.toContain('Estimated population:');
    });
  });

  describe('Tab Navigation', () => {
    it('should initialize with activeTab set to hazards', () => {
      expect(component.activeTab).toBe('hazards');
    });

    it('should set activeTab to actions when setActiveTab is called', () => {
      component.setActiveTab('actions');
      expect(component.activeTab).toBe('actions');
    });

    it('should set activeTab to solutions when setActiveTab is called', () => {
      component.setActiveTab('solutions');
      expect(component.activeTab).toBe('solutions');
    });

    it('should set activeTab back to hazards when setActiveTab is called', () => {
      component.setActiveTab('solutions');
      expect(component.activeTab).toBe('solutions');

      component.setActiveTab('hazards');
      expect(component.activeTab).toBe('hazards');
    });

    it('should update activeTab multiple times', () => {
      component.setActiveTab('actions');
      expect(component.activeTab).toBe('actions');

      component.setActiveTab('solutions');
      expect(component.activeTab).toBe('solutions');

      component.setActiveTab('hazards');
      expect(component.activeTab).toBe('hazards');
    });

    it('emits the new active tab when changed', () => {
      const emitSpy = spyOn(component.activeTabChange, 'emit');

      component.setActiveTab('actions');

      expect(emitSpy).toHaveBeenCalledWith('actions');
    });
  });

  describe('Navigation', () => {
    it('should emit backToMap event when goBackToMap is called', () => {
      const emitSpy = spyOn(component.backToMap, 'emit');
      component.goBackToMap();
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('Data Input', () => {
    it('should have null data by default', () => {
      expect(component.data).toBeNull();
    });

    it('should accept LocationProfile data', () => {
      component.data = mockLocationData;
      expect(component.data).toEqual(mockLocationData);
      expect(component.data?.name).toBe('Minas Gerais');
    });

    it('should handle data changes', () => {
      component.data = mockLocationData;
      expect(component.data).toEqual(mockLocationData);

      const newData: LocationProfile = {
        ...mockLocationData,
        name: 'São Paulo',
      };

      component.data = newData;
      expect(component.data?.name).toBe('São Paulo');
    });

    it('should allow setting data back to null', () => {
      component.data = mockLocationData;
      expect(component.data).not.toBeNull();

      component.data = null;
      expect(component.data).toBeNull();
    });
  });

  describe('Component Integration', () => {
    it('should maintain tab state independent of data', () => {
      component.setActiveTab('actions');
      expect(component.activeTab).toBe('actions');

      component.data = mockLocationData;
      expect(component.activeTab).toBe('actions');
    });

    it('should allow tab switching with data present', () => {
      component.data = mockLocationData;

      component.setActiveTab('hazards');
      expect(component.activeTab).toBe('hazards');

      component.setActiveTab('actions');
      expect(component.activeTab).toBe('actions');

      component.setActiveTab('solutions');
      expect(component.activeTab).toBe('solutions');
    });
  });

  describe('Adaptation Actions Banner', () => {
    beforeEach(() => {
      component.data = mockLocationData;
    });

    it('should set filter and switch to tab 1 when exploreHazardActions is called', () => {
      const emitSpy = spyOn(component.actionHazardFilterChange, 'emit');
      const heatHazard = { hazardType: 'EXTREME_HEAT' as any };
      component.exploreHazardActions(heatHazard);

      expect(component.selectedHazardFilter).toBe('EXTREME_HEAT|');
      expect(component.activeTab).toBe('actions');
      expect(emitSpy).toHaveBeenCalledWith('EXTREME_HEAT|');
    });

    it('should handle "OTHERS" in exploreHazardActions', () => {
      const otherHazard = { hazardType: 'OTHERS' as any, otherHazardDetails: 'Wildfire' };
      component.exploreHazardActions(otherHazard);

      expect(component.selectedHazardFilter).toBe('OTHERS|Wildfire');
      expect(component.activeTab).toBe('actions');
    });

    it('emits null when leaving the actions tab clears the hazard filter', () => {
      const emitSpy = spyOn(component.actionHazardFilterChange, 'emit');
      component.exploreHazardActions({ hazardType: 'EXTREME_HEAT' as any });
      emitSpy.calls.reset();

      component.setActiveTab('hazards');

      expect(component.selectedHazardFilter).toBeNull();
      expect(emitSpy).toHaveBeenCalledWith(null);
    });
  });
});
