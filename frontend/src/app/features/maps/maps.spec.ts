import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { GoogleMapsLoaderService } from '../../shared/services/google-maps-loader.service';
import { Maps } from './maps';
import { LocationPinsService } from './location-pins.service';
import { MapSelectionService } from '../main-search/map-selection.service';
import { LocationPin, OrgTypeEnum } from '@pac-api/client';
import { NgZone } from '@angular/core';

class MockAdvancedMarkerElement {
  public content: any;
  public zIndex: number;
  public addListener = jasmine.createSpy('addListener');
  constructor(options: any) {
    this.content = options.content;
    this.zIndex = options.zIndex;
  }
}

describe('Maps', () => {
  let component: Maps;
  let fixture: ComponentFixture<Maps>;
  let googleMapsLoaderService: jasmine.SpyObj<GoogleMapsLoaderService>;
  let locationPinsService: jasmine.SpyObj<LocationPinsService>;
  let mapSelectionService: jasmine.SpyObj<MapSelectionService>;
  let mockMapInstance: any;

  const mockPins: LocationPin[] = [
    { name: 'City A', lat: 10, lng: 20, orgType: OrgTypeEnum.CITY },
    { name: 'Region B', lat: 30, lng: 40, orgType: OrgTypeEnum.STATE_AND_REGION },
  ];

  const selectedMapLocation$ = new BehaviorSubject<LocationPin | null>(null);

  beforeEach(async () => {
    spyOnProperty(window, 'innerWidth').and.returnValue(1024);
    googleMapsLoaderService = jasmine.createSpyObj('GoogleMapsLoaderService', ['loadApi']);
    googleMapsLoaderService.loadApi.and.returnValue(of(true));

    locationPinsService = jasmine.createSpyObj('LocationPinsService', ['getAllLocationPins']);
    locationPinsService.getAllLocationPins.and.returnValue(of(mockPins));

    mapSelectionService = jasmine.createSpyObj('MapSelectionService', [
      'selectLocation',
      'clearSelection',
      'getSelectedLocation',
    ]);
    (mapSelectionService as any).selectedMapLocation$ = selectedMapLocation$.asObservable();
    mapSelectionService.getSelectedLocation.and.returnValue(null);

    mockMapInstance = {
      addListener: jasmine.createSpy('addListener'),
      panTo: jasmine.createSpy('panTo'),
      setZoom: jasmine.createSpy('setZoom'),
    };

    (window as any).google = {
      maps: {
        Map: jasmine.createSpy('Map').and.returnValue(mockMapInstance),
        MapTypeId: { ROADMAP: 'roadmap' },
        marker: {
          AdvancedMarkerElement: MockAdvancedMarkerElement,
        },
        event: {
          addListenerOnce: jasmine.createSpy('addListenerOnce'),
        },
        geometry: {
          spherical: {
            computeOffset: jasmine.createSpy('computeOffset'),
          },
        },
        LatLng: jasmine.createSpy('LatLng'),
      },
    };

    await TestBed.configureTestingModule({
      imports: [Maps, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GoogleMapsLoaderService, useValue: googleMapsLoaderService },
        { provide: LocationPinsService, useValue: locationPinsService },
        { provide: MapSelectionService, useValue: mapSelectionService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Maps);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Pin Styling Logic', () => {
    it('should return different styles for selected and unselected pins', () => {
      const unselected = (component as any).getPinStyle(OrgTypeEnum.CITY, false);
      const selected = (component as any).getPinStyle(OrgTypeEnum.CITY, true);

      expect(unselected.iconUrl).toBeDefined();
      expect(selected.iconUrl).toBeDefined();
      expect(selected.iconUrl).not.toBe(unselected.iconUrl);
      expect(selected.zIndex).toBeGreaterThan(unselected.zIndex);
    });

    it('should return different icons for different org types', () => {
      const city = (component as any).getPinStyle(OrgTypeEnum.CITY, false);
      const region = (component as any).getPinStyle(OrgTypeEnum.STATE_AND_REGION, false);

      expect(city.iconUrl).not.toBe(region.iconUrl);
    });
  });

  describe('Marker Updates', () => {
    it('should update marker appearance when a location is selected', fakeAsync(() => {
      // Initially no selection
      const cityAMarkerData = (component as any).markers.get('City A');
      const unselectedZIndex = cityAMarkerData.marker.zIndex;
      const unselectedSrc = (cityAMarkerData.marker.content as HTMLImageElement).src;

      // Select City A
      selectedMapLocation$.next(mockPins[0]);
      tick();

      const selectedMarkerData = (component as any).markers.get('City A');
      expect(selectedMarkerData.marker.zIndex).toBeGreaterThan(unselectedZIndex);
      expect((selectedMarkerData.marker.content as HTMLImageElement).src).not.toBe(unselectedSrc);

      // Select Region B, City A should be reset
      selectedMapLocation$.next(mockPins[1]);
      tick();

      expect(cityAMarkerData.marker.zIndex).toBe(unselectedZIndex);
      expect((cityAMarkerData.marker.content as HTMLImageElement).src).toBe(unselectedSrc);

      const regionBMarkerData = (component as any).markers.get('Region B');
      expect(regionBMarkerData.marker.zIndex).toBeGreaterThan(unselectedZIndex);
    }));

    it('should reset markers when selection is cleared', fakeAsync(() => {
      const cityAMarkerData = (component as any).markers.get('City A');
      const unselectedZIndex = cityAMarkerData.marker.zIndex;

      // Select City A
      selectedMapLocation$.next(mockPins[0]);
      tick();
      expect(cityAMarkerData.marker.zIndex).toBeGreaterThan(unselectedZIndex);

      // Clear selection
      selectedMapLocation$.next(null);
      tick();

      expect(cityAMarkerData.marker.zIndex).toBe(unselectedZIndex);
    }));
  });
});
