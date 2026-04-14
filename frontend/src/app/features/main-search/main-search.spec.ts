import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MainSearchComponent } from './main-search';
import { SearchService } from './search.service';
import { LocationService } from '../../shared/services/location.service';
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
import { of, throwError, Observable, Subject, skip, take } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Maps } from '../maps/maps';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule } from '@angular/forms';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatAutocompleteHarness } from '@angular/material/autocomplete/testing';

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
class StubMapsComponent {}

describe('MainSearchComponent', () => {
  let component: MainSearchComponent;
  let fixture: ComponentFixture<MainSearchComponent>;
  let mockSearchService: jasmine.SpyObj<SearchService>;
  let mockLocationService: jasmine.SpyObj<LocationService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let translate: TranslateService;
  let loader: HarnessLoader;
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
        MatAutocompleteModule,
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
    loader = TestbedHarnessEnvironment.loader(fixture);
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
    expect(compiled.querySelector('input[type="search"]')).toBeTruthy();
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

    it('should display autocomplete options when typing', async () => {
      const harness = await loader.getHarness(MatAutocompleteHarness);
      await harness.focus();
      await harness.enterText('Lo');

      const options = await harness.getOptions();
      const texts = await Promise.all(options.map((o) => o.getText()));

      expect(texts).toContain('London');
      expect(texts).toContain('Los Angeles');
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

    it('should limit the number of suggestions to 3', fakeAsync(() => {
      // Provide more than 3 suggestions
      const manySuggestions = [
        { organizationId: 201, name: 'Paris', disclosesToCDP: true },
        { organizationId: 202, name: 'Perth', disclosesToCDP: false },
        { organizationId: 203, name: 'Porto', disclosesToCDP: true },
        { organizationId: 204, name: 'Prague', disclosesToCDP: false },
      ];
      // Mock the location service to return the many suggestions
      mockLocationService.getAllLocationNames.and.returnValue(of(manySuggestions));

      recreateComponent();

      let suggestions: any[] = [];
      component.filteredLocations.subscribe((opts) => {
        suggestions = opts;
      });

      component.searchControl.setValue('p');
      tick();

      // The first emission from startWith('') will set suggestions,
      // then the emission from setValue('p') will update it.
      expect(suggestions.length).toBe(3);
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
      // Use the red color text class as a selector for the not found heading
      const errorMessage = compiled.querySelector('.text-cdp-red.text-base.font-medium');
      expect(errorMessage?.textContent).toContain("Sorry, we couldn't find Unknown City");
    });

    it('should show close icon when location is not found', () => {
      component.isNotFound = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const icon = compiled.querySelector('button mat-icon');
      expect(icon?.textContent).toBe('close');
    });

    it('should show spinner when loading', () => {
      component.isLoadingLocation = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const spinner = compiled.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
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

    it('opens autocomplete when the input is focused and suggestions exist', fakeAsync(() => {
      const openPanel = jasmine.createSpy('openPanel');
      const trigger = { openPanel, panelOpen: false } as any;

      spyOn(console, 'debug');

      component.onSearchInputInteraction('focus', trigger);
      tick();

      expect(openPanel).toHaveBeenCalled();
      expect(console.debug).toHaveBeenCalled();
    }));

    it('opens autocomplete after locations load if the input was already focused', fakeAsync(() => {
      const suggestions$ = new Subject<any[]>();
      const openPanel = jasmine.createSpy('openPanel');
      const trigger = { openPanel, panelOpen: false } as any;

      mockLocationService.getAllLocationNames.and.returnValue(suggestions$);
      recreateComponent();

      component.onSearchInputInteraction('focus', trigger);
      tick();

      expect(openPanel).not.toHaveBeenCalled();

      suggestions$.next(MOCK_SUGGESTIONS);
      tick();

      expect(openPanel).toHaveBeenCalled();
    }));

    it('should navigate back to main route when back is clicked', () => {
      component.onBackHome();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
