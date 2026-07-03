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
import { AnalyticsService } from '../../core/analytics/analytics.service';

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
  @Input() categoryFilter: 'all' | 'cities' | 'states-regions' = 'all';
}

describe('MainSearchComponent', () => {
  let component: MainSearchComponent;
  let fixture: ComponentFixture<MainSearchComponent>;
  let mockSearchService: jasmine.SpyObj<SearchService>;
  let mockLocationService: jasmine.SpyObj<LocationService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockAnalyticsService: jasmine.SpyObj<AnalyticsService>;
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
    { organizationId: 101, name: 'London', disclosesToCDP: true, isReportingLeader: false },
    { organizationId: 102, name: 'Los Angeles', disclosesToCDP: false, isReportingLeader: false },
    { organizationId: 103, name: 'Vegas', disclosesToCDP: true, isReportingLeader: false },
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
    mockAnalyticsService = jasmine.createSpyObj('AnalyticsService', ['capture']);

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
        { provide: AnalyticsService, useValue: mockAnalyticsService },
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

      // Empty-state order is randomized; assert set, not order.
      // (MOCK_SUGGESTIONS < MAX_SUGGESTIONS so all survive the slice.)
      expect([...suggestions].sort()).toEqual(['London', 'Los Angeles', 'Vegas']);
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

      // See note above — empty-state order is randomized.
      expect([...suggestions].sort()).toEqual(['London', 'Los Angeles', 'Vegas']);
    }));

    it('should return no results for irrelevant query', () => {
      let suggestions: any[] = [];
      component.filteredLocations.pipe(skip(1), take(1)).subscribe((opts) => {
        suggestions = opts;
      });

      component.searchControl.setValue('xyz');

      expect(suggestions).toEqual([]);
    });

    it('should preserve Federal District aliases for Mexico City and Brazil suggestions', fakeAsync(() => {
      const federalDistrictSuggestions = [
        {
          organizationId: 31172,
          name: 'Mexico City',
          country: 'Mexico',
          disclosesToCDP: true,
          isReportingLeader: false,
        },
        {
          organizationId: 50353,
          name: 'Distrito Federal, Brasil',
          country: 'Brazil',
          disclosesToCDP: true,
          isReportingLeader: false,
        },
        {
          organizationId: 50354,
          name: 'Distrito Federal, Brasília',
          country: 'Brazil',
          disclosesToCDP: true,
          isReportingLeader: false,
        },
      ];
      mockLocationService.getAllLocationNames.and.returnValue(of(federalDistrictSuggestions));

      recreateComponent();

      let suggestions: string[] = [];
      component.filteredLocations.subscribe((opts) => {
        suggestions = opts.map((option) => option.name);
      });

      component.searchControl.setValue('Federal District');
      tick();

      expect(suggestions).toContain('Mexico City');
      expect(suggestions).toContain('Distrito Federal, Brasil');
      expect(suggestions).toContain('Distrito Federal, Brasília');

      component.searchControl.setValue('Federal District, Mexico');
      tick();

      expect(suggestions).toContain('Mexico City');

      component.searchControl.setValue('Distrito Federal');
      tick();

      expect(suggestions).toContain('Mexico City');
      expect(suggestions).toContain('Distrito Federal, Brasil');
      expect(suggestions).toContain('Distrito Federal, Brasília');
    }));

    it('should limit the number of suggestions to 5', fakeAsync(() => {
      const manySuggestions = [
        { organizationId: 201, name: 'Paris', disclosesToCDP: true, isReportingLeader: false },
        { organizationId: 202, name: 'Perth', disclosesToCDP: false, isReportingLeader: false },
        { organizationId: 203, name: 'Porto', disclosesToCDP: true, isReportingLeader: false },
        { organizationId: 204, name: 'Prague', disclosesToCDP: false, isReportingLeader: false },
        { organizationId: 205, name: 'Phoenix', disclosesToCDP: true, isReportingLeader: false },
        { organizationId: 206, name: 'Portland', disclosesToCDP: true, isReportingLeader: false },
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

    it('should move the active suggestion with arrow keys', () => {
      component.searchControl.setValue('Lo');
      fixture.detectChanges();

      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(component.activeSuggestionIndex).toBe(0);

      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(component.activeSuggestionIndex).toBe(1);

      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(component.activeSuggestionIndex).toBe(0);

      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(component.activeSuggestionIndex).toBe(1);
    });

    it('should select the active suggestion when Enter is pressed', () => {
      component.searchControl.setValue('Lo');
      fixture.detectChanges();

      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/org', 101]);
    });

    it('should select the first visible suggestion when Enter is pressed without an active suggestion', () => {
      component.searchControl.setValue('Lo');
      fixture.detectChanges();

      component.onSearchKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/org', 101]);
    });
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
      const backButton = Array.from(compiled.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Go back'),
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

    it('toggles the map category filter from the legend', () => {
      component.setMapCategoryFilter('cities');

      expect(component.selectedMapCategoryFilter).toBe('cities');

      component.setMapCategoryFilter('cities');

      expect(component.selectedMapCategoryFilter).toBe('all');
      expect(mockAnalyticsService.capture).toHaveBeenCalledWith('map_category_filter_selected', {
        category: 'all',
        source: 'homepage_legend',
      });
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
