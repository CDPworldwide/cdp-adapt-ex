import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { HazardMapComponent } from './hazard-map';
import { SimpleChange } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { GoogleMapsLoaderService } from '../../shared/services/google-maps-loader.service';
import { HazardEnum, ScenarioEnum } from '@pac-api/client';

describe('HazardMapComponent', () => {
  let component: HazardMapComponent;
  let fixture: ComponentFixture<HazardMapComponent>;
  let mockMapInstance: any;
  let mapConstructorSpy: jasmine.Spy;
  let eventTriggerSpy: jasmine.Spy;
  let googleMapsLoaderService: jasmine.SpyObj<GoogleMapsLoaderService>;

  beforeEach(async () => {
    mockMapInstance = {
      setCenter: jasmine.createSpy('setCenter'),
      fitBounds: jasmine.createSpy('fitBounds'),
      setOptions: jasmine.createSpy('setOptions'),
      overlayMapTypes: {
        push: jasmine.createSpy('push'),
        clear: jasmine.createSpy('clear'),
        getLength: jasmine.createSpy('getLength').and.returnValue(0),
      },
      data: {
        addMap: jasmine.createSpy('addMap'),
        setMap: jasmine.createSpy('setMap'),
      },
    };

    mapConstructorSpy = jasmine.createSpy('Map').and.callFake(function (this: any) {
      Object.assign(this, mockMapInstance);
      return this;
    });

    eventTriggerSpy = jasmine.createSpy('trigger');

    (window as any).google = {
      maps: {
        Map: mapConstructorSpy,
        MapTypeId: { ROADMAP: 'roadmap' },
        event: { trigger: eventTriggerSpy },
        LatLngBounds: class {
          isEmpty = () => false;
        },
        Data: jasmine.createSpy('Data').and.callFake(function (this: any) {
          this.addGeoJson = jasmine.createSpy('addGeoJson');
          this.setStyle = jasmine.createSpy('setStyle');
          this.setMap = jasmine.createSpy('setMap');
          return this;
        }),
      },
    };

    googleMapsLoaderService = jasmine.createSpyObj('GoogleMapsLoaderService', ['loadApi']);
    googleMapsLoaderService.loadApi.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [HazardMapComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: GoogleMapsLoaderService,
          useValue: googleMapsLoaderService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HazardMapComponent);
    component = fixture.componentInstance;

    // Set default required inputs for all tests
    component.lat = 0;
    component.lng = 0;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.zoom).toBe(5);
    expect(component.hazardType).toBeUndefined();
  });

  it('should accept custom input values', () => {
    component.lat = 40.7128;
    component.lng = -74.006;
    component.zoom = 10;
    component.hazardType = HazardEnum.EXTREME_HEAT;

    expect(component.lat).toBe(40.7128);
    expect(component.lng).toBe(-74.006);
    expect(component.zoom).toBe(10);
    expect(component.hazardType).toBe(HazardEnum.EXTREME_HEAT);
  });

  it('should start with isExpanded as false', () => {
    expect(component.isExpanded).toBe(false);
  });

  it('should toggle isExpanded when toggleExpand is called', () => {
    component.toggleExpand();
    expect(component.isExpanded).toBe(true);

    component.toggleExpand();
    expect(component.isExpanded).toBe(false);
  });

  it('should initialize map on ngOnInit', () => {
    fixture.detectChanges();
    expect(mapConstructorSpy).toHaveBeenCalled();
  });

  it('should create map with correct center and zoom', () => {
    component.lat = 51.5074;
    component.lng = -0.1278;
    component.zoom = 12;

    fixture.detectChanges();

    expect(mapConstructorSpy).toHaveBeenCalledWith(
      jasmine.any(HTMLElement),
      jasmine.objectContaining({
        center: { lat: 51.5074, lng: -0.1278 },
        zoom: 12,
      }),
    );
  });

  it('should update map center when coordinates change', () => {
    fixture.detectChanges();

    component.lat = 35.6762;
    component.lng = 139.6503;
    component.ngOnChanges({
      lat: new SimpleChange(0, 35.6762, false),
      lng: new SimpleChange(0, 139.6503, false),
    });

    expect(mockMapInstance.setCenter).toHaveBeenCalledWith({ lat: 35.6762, lng: 139.6503 });
  });

  it('should clean up googleMap reference on destroy', () => {
    fixture.detectChanges();
    component.ngOnDestroy();
    expect(component['googleMap']).toBeNull();
  });

  it('should trigger map resize on expand', fakeAsync(() => {
    fixture.detectChanges();
    component.toggleExpand();

    tick(32);

    expect(eventTriggerSpy).toHaveBeenCalledWith(jasmine.anything(), 'resize');
  }));

  describe('updateYearRangesForScenario', () => {
    const mockHazardLayerConfig = {
      [HazardEnum.RIVER_FLOODING]: {
        scenarios: [ScenarioEnum.HISTORICAL, ScenarioEnum.SSP126, ScenarioEnum.SSP585],
        year_ranges: [
          { start: 2030, end: 2030 },
          { start: 2040, end: 2040 },
          { start: 2050, end: 2050 },
        ],
        historical_year_range: { start: 1980, end: 1980 },
        palette: [],
        source: '',
        partial_image_id_templates: {},
      },
    };

    beforeEach(() => {
      // Set a default hazard layer config for the component
      component['hazardLayerConfig'] = mockHazardLayerConfig;
      component.hazardType = HazardEnum.RIVER_FLOODING;
    });

    it('should set yearRanges to historical_year_range for HISTORICAL scenario', () => {
      component.selectedScenario = ScenarioEnum.HISTORICAL;
      component['updateYearRangesForScenario']();
      expect(component.yearRanges).toEqual([
        mockHazardLayerConfig[HazardEnum.RIVER_FLOODING].historical_year_range,
      ]);
    });

    it('should set yearRanges to year_ranges for future scenarios', () => {
      component.selectedScenario = ScenarioEnum.SSP126;
      component['updateYearRangesForScenario']();
      expect(component.yearRanges).toEqual(
        mockHazardLayerConfig[HazardEnum.RIVER_FLOODING].year_ranges,
      );

      component.selectedScenario = ScenarioEnum.SSP585;
      component['updateYearRangesForScenario']();
      expect(component.yearRanges).toEqual(
        mockHazardLayerConfig[HazardEnum.RIVER_FLOODING].year_ranges,
      );
    });

    it('should update selectedYearRange if it is no longer valid', () => {
      component.selectedScenario = ScenarioEnum.SSP126;
      component.selectedYearRange = { start: 1980, end: 1980 }; // An invalid range for SSP126
      component['updateYearRangesForScenario']();
      expect(component.selectedYearRange).toEqual(
        mockHazardLayerConfig[HazardEnum.RIVER_FLOODING].year_ranges[0],
      );
    });

    it('should not change selectedYearRange if it is still valid', () => {
      const validYearRange = { start: 2040, end: 2040 };
      component.selectedScenario = ScenarioEnum.SSP126;
      component.yearRanges = mockHazardLayerConfig[HazardEnum.RIVER_FLOODING].year_ranges;
      component.selectedYearRange = validYearRange;

      component['updateYearRangesForScenario']();

      expect(component.selectedYearRange).toEqual(validYearRange);
    });

    it('should set selectedYearRange to the first available year range for a new scenario', () => {
      // Start with historical
      component.selectedScenario = ScenarioEnum.HISTORICAL;
      component['updateYearRangesForScenario']();
      expect(component.selectedYearRange).toEqual({ start: 1980, end: 1980 });

      // Change to a future scenario
      component.selectedScenario = ScenarioEnum.SSP585;
      component['updateYearRangesForScenario']();
      expect(component.selectedYearRange).toEqual({ start: 2030, end: 2030 });
    });

    it('should not fail if config for hazardType is missing', () => {
      component.hazardType = HazardEnum.COASTAL_FLOODING; // A type not in mock config
      expect(() => component['updateYearRangesForScenario']()).not.toThrow();
    });
  });

  it('should render jurisdiction boundary when geometry is provided', fakeAsync(() => {
    const mockGeometry = { type: 'Polygon', coordinates: [] };
    component.geometry = mockGeometry;
    fixture.detectChanges();
    tick();

    const dataSpy = (window as any).google.maps.Data;
    expect(dataSpy).toHaveBeenCalled();
    const dataInstance = dataSpy.calls.mostRecent().returnValue;
    expect(dataInstance.addGeoJson).toHaveBeenCalled();
    expect(dataInstance.setStyle).toHaveBeenCalledWith(
      jasmine.objectContaining({
        strokeColor: '#000000',
        strokeWeight: 2,
      }),
    );
    expect(dataInstance.setMap).toHaveBeenCalledWith(jasmine.any(Object));
  }));

  it('should fit map to calculated bounds when provided', fakeAsync(() => {
    const mockBounds = new (window as any).google.maps.LatLngBounds();
    component.geometry = { type: 'Polygon', coordinates: [] };
    component.calculatedBounds = mockBounds;
    fixture.detectChanges();
    tick();

    expect(mockMapInstance.fitBounds).toHaveBeenCalledWith(mockBounds);
  }));
});
