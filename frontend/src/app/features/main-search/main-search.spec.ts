import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MainSearchComponent } from './main-search';
import { SearchService } from './search.service';
import { LocationService } from '../../shared/services/location.service';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of, throwError, Observable, Subject, skip, take } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Maps } from '../maps/maps';
import { ReactiveFormsModule } from '@angular/forms';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<any> {
    return of({
      homepage: {
        hero: {
          notFound: "Sorry, we couldn't find {{location}}",
          notFoundExplanation: 'Explanation text',
          trySearchingAgain: 'Try searching again',
          goBack: 'Go back',
        },
      },
    });
  }
}

@Component({
  selector: 'app-maps',
  standalone: true,
  template: '',
})
class StubMapsComponent {
  @Input() pinFilter: 'all' | 'city' | 'region' = 'all';
}

describe('MainSearchComponent', () => {
  let component: MainSearchComponent;
  let fixture: ComponentFixture<MainSearchComponent>;
  let mockSearchService: jasmine.SpyObj<SearchService>;
  let mockLocationService: jasmine.SpyObj<LocationService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let translate: TranslateService;
  const MOCK_LOCATION_DATA = {
    name: 'London',
    countryName: 'United Kingdom',
    lat: 51.5074,
    lng: -0.1278,
    hazards: {
      statistics: {
        populationExposedValue: null,
        populationExposedPercentage: null,
        gdpAtRiskValue: null,
        gdpAtRiskPercentage: null,
        gdpAtRiskCurrencyCode: null,
        vulnerableSectors: [],
      },
      hazards: [],
    },
    governmentActions: {
      goals: [],
      actions: [],
      projects: [],
    },
    solutions: {
      solutions: {},
    },
  } as any;

  const MOCK_SUGGESTIONS = [
    { organizationId: 101, name: 'London', disclosesToCDP: true },
    { organizationId: 102, name: 'Los Angeles', disclosesToCDP: false },
    { organizationId: 103, name: 'Vegas', disclosesToCDP: true },
  ];

  const recreateComponent = () => {
    fixture.destroy();
    fixture = TestBed.createComponent(MainSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockSearchService = jasmine.createSpyObj('SearchService', ['searchLocation']);
    mockLocationService = jasmine.createSpyObj('LocationService', ['getAllLocationNames']);
    mockRouter = jasmine.createSpyObj('Router', [
      'navigate',
      'createUrlTree',
      'serializeUrl',
      'isActive',
    ]);
    (mockRouter as any).events = of();
    mockRouter.createUrlTree.and.returnValue({} as any);
    mockRouter.serializeUrl.and.returnValue('');
    mockRouter.isActive.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [
        MainSearchComponent,
        StubMapsComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: FakeLoader },
        }),
        HttpClientTestingModule,
      ],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: LocationService, useValue: mockLocationService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: {} },
      ],
    })
      .overrideComponent(MainSearchComponent, {
        remove: { imports: [Maps] },
        add: { imports: [StubMapsComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MainSearchComponent);
    component = fixture.componentInstance;
    translate = TestBed.inject(TranslateService);
    translate.use('en');
    // mock location names
    mockLocationService.getAllLocationNames.and.returnValue(of(MOCK_SUGGESTIONS));
    fixture.detectChanges();
  });

  it('should create and load location names', () => {
    expect(component).toBeTruthy();
    expect(mockLocationService.getAllLocationNames).toHaveBeenCalled();
    expect(component.allLocations).toEqual(MOCK_SUGGESTIONS);
  });

  it('should render the search input', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[type="text"]')).toBeTruthy();
  });

  describe('Autocomplete', () => {
    it('should filter location names based on input', () => {
      let suggestions: string[] = [];
      component.filteredLocations.pipe(skip(1), take(1)).subscribe((opts) => {
        suggestions = opts.map((o) => o.name);
      });

      component.searchControl.setValue('Lo');

      expect(suggestions).toEqual(['London', 'Los Angeles']);
    });

    it('should return correct result with a typo in search', () => {
      let suggestions: string[] = [];
      component.filteredLocations.pipe(skip(1), take(1)).subscribe((opts) => {
        suggestions = opts.map((o) => o.name);
      });

      component.searchControl.setValue('Londo');

      expect(suggestions).toEqual(['London']);
    });

    it('should be case-insensitive', () => {
      let suggestions: string[] = [];
      component.filteredLocations.pipe(skip(1), take(1)).subscribe((opts) => {
        suggestions = opts.map((o) => o.name);
      });

      component.searchControl.setValue('london');

      expect(suggestions).toEqual(['London']);
    });

    it('should return all locations for empty search', () => {
      let suggestions: string[] = [];
      component.filteredLocations.pipe(take(1)).subscribe((opts) => {
        suggestions = opts.map((o) => o.name);
      });

      expect(suggestions).toEqual(['London', 'Los Angeles', 'Vegas']);
    });

    it('should update empty-state suggestions when locations load after init', fakeAsync(() => {
      const suggestions$ = new Subject<any[]>();
      mockLocationService.getAllLocationNames.and.returnValue(suggestions$);
      recreateComponent();

      let suggestions: string[] = [];
      component.filteredLocations.subscribe((opts) => {
        suggestions = opts.map((option) => option.name);
      });

      tick();
      expect(suggestions).toEqual([]);

      suggestions$.next(MOCK_SUGGESTIONS);
      tick();

      expect(suggestions).toEqual(['London', 'Los Angeles', 'Vegas']);
    }));

    it('should return no results for irrelevant query', () => {
      let suggestions: any[] = [];
      component.filteredLocations.pipe(skip(1), take(1)).subscribe((opts) => {
        suggestions = opts;
      });

      component.searchControl.setValue('xyz');

      expect(suggestions).toEqual([]);
    });

    it('should limit the number of suggestions to 5', fakeAsync(() => {
      const manySuggestions = [
        { organizationId: 201, name: 'Paris', disclosesToCDP: true },
        { organizationId: 202, name: 'Perth', disclosesToCDP: false },
        { organizationId: 203, name: 'Porto', disclosesToCDP: true },
        { organizationId: 204, name: 'Prague', disclosesToCDP: false },
        { organizationId: 205, name: 'Phoenix', disclosesToCDP: true },
        { organizationId: 206, name: 'Portland', disclosesToCDP: true },
      ];
      mockLocationService.getAllLocationNames.and.returnValue(of(manySuggestions));

      recreateComponent();

      let suggestions: any[] = [];
      component.filteredLocations.subscribe((opts) => {
        suggestions = opts;
      });

      component.searchControl.setValue('p');
      tick();

      expect(suggestions.length).toBe(5);
    }));
  });

  describe('Search Functionality', () => {
    it('should display error dropdown when search fails', () => {
      mockSearchService.searchLocation.and.returnValue(throwError(() => new Error('Not Found')));

      component.searchControl.setValue('Unknown City');
      component.onSearch();
      fixture.detectChanges();

      expect(component.isNotFound).toBeTrue();
      const compiled = fixture.nativeElement as HTMLElement;
      // The not-found message renders in the big-text style — pick the
      // span that carries both .text-cdp-red and .font-light to skip the
      // (also-red) close icon next to it.
      const errorMessage = compiled.querySelector('span.text-cdp-red.font-light');
      expect(errorMessage?.textContent).toContain("Sorry, we couldn't find Unknown City");
    });

    it('should show the not-found close icon when location is not found', () => {
      component.isNotFound = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // The not-found state renders a button with a leading mat-icon "close".
      const button = compiled.querySelector(
        'button[aria-label^="Sorry"]',
      ) as HTMLButtonElement | null;
      const icon = button?.querySelector('mat-icon');
      expect(icon?.textContent).toBe('close');
    });

    it('should clear error state when typing in the search box', () => {
      component.isNotFound = true;
      component.onInput();

      expect(component.isNotFound).toBeFalse();
    });

    it('should clear search and navigate home when "Go back" is clicked', () => {
      spyOn(component, 'onBackHome').and.callThrough();
      component.isNotFound = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const backButton = Array.from(compiled.querySelectorAll('button')).find(
        (btn) => btn.textContent?.includes('Go back'),
      );

      backButton?.click();

      expect(component.onBackHome).toHaveBeenCalled();
      expect(component.isNotFound).toBeFalse();
      expect(component.searchControl.value).toBe('');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should navigate to org route when searching from input', () => {
      component.searchControl.setValue('London');

      component.onSearch();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/org', 101]);
    });

    it('should navigate to org route when selecting autocomplete suggestion', () => {
      component.onSearch('Los Angeles');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/org', 102]);
    });

    it('opens the search overlay when openSearchOverlay is called', () => {
      expect(component.isOverlayOpen).toBeFalse();

      component.openSearchOverlay();

      expect(component.isOverlayOpen).toBeTrue();
    });

    it('closes the search overlay when closeSearchOverlay is called', () => {
      component.openSearchOverlay();
      expect(component.isOverlayOpen).toBeTrue();

      component.closeSearchOverlay();

      expect(component.isOverlayOpen).toBeFalse();
    });

    it('closes the search overlay when Escape is pressed', () => {
      component.openSearchOverlay();
      expect(component.isOverlayOpen).toBeTrue();

      component.onEscapeKey();

      expect(component.isOverlayOpen).toBeFalse();
    });

    it('splitMatch highlights the matched query within a name', () => {
      const parts = component.splitMatch('San Francisco, USA', 'San');

      expect(parts).toEqual([
        { text: '', bold: false },
        { text: 'San', bold: true },
        { text: ' Francisco, USA', bold: false },
      ]);
    });

    it('splitMatch returns the whole name when query is empty', () => {
      const parts = component.splitMatch('London', '');

      expect(parts).toEqual([{ text: 'London', bold: false }]);
    });

    it('splitMatch returns the whole name when query does not match', () => {
      const parts = component.splitMatch('London', 'xyz');

      expect(parts).toEqual([{ text: 'London', bold: false }]);
    });

    it('should navigate back to main route when back is clicked', () => {
      component.onBackHome();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
