import { TestBed } from '@angular/core/testing';
import { GeometryService } from './geometry.service';
import { GoogleMapsLoaderService } from './google-maps-loader.service';
import { of } from 'rxjs';

describe('GeometryService', () => {
  let service: GeometryService;
  let googleMapsLoaderSpy: jasmine.SpyObj<GoogleMapsLoaderService>;

  beforeEach(() => {
    const loaderSpy = jasmine.createSpyObj('GoogleMapsLoaderService', ['loadApi']);
    loaderSpy.loadApi.and.returnValue(of(true));

    TestBed.configureTestingModule({
      providers: [GeometryService, { provide: GoogleMapsLoaderService, useValue: loaderSpy }],
    });
    service = TestBed.inject(GeometryService);
    googleMapsLoaderSpy = TestBed.inject(
      GoogleMapsLoaderService,
    ) as jasmine.SpyObj<GoogleMapsLoaderService>;

    // Mock google maps
    (window as any).google = {
      maps: {
        LatLngBounds: class {
          extend = jasmine.createSpy('extend');
          isEmpty = jasmine.createSpy('isEmpty').and.returnValue(false);
        },
        Data: class {
          addGeoJson = jasmine.createSpy('addGeoJson');
          forEach = jasmine.createSpy('forEach').and.callFake((callback: any) => {
            callback({
              getGeometry: () => ({
                forEachLatLng: (latLngCallback: any) => {
                  latLngCallback({ lat: 1, lng: 1 });
                },
              }),
            });
          });
        },
      },
    };
  });

  afterEach(() => {
    delete (window as any).google;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return undefined if no geometry is provided', (done) => {
    service.calculateBounds(null as any).subscribe((bounds) => {
      expect(bounds).toBeUndefined();
      done();
    });
  });

  it('should calculate bounds using google.maps.Data', (done) => {
    const mockGeometry = { type: 'Polygon', coordinates: [] };
    service.calculateBounds(mockGeometry).subscribe((bounds) => {
      expect(bounds).toBeDefined();
      expect(googleMapsLoaderSpy.loadApi).toHaveBeenCalled();
      done();
    });
  });
});
