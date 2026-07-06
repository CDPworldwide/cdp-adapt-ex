import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Observable, combineLatest, map, of, startWith } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SearchService, LocationData } from './search.service';
import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { MapSelectionService } from './map-selection.service';
import {
  filterLocationSuggestions,
  normalizeLocationSearch,
  stripDiacritics,
} from '../../shared/services/location-search.util';
import { Maps, type MapCategoryFilter } from '../maps/maps';
import { LocationSummaryComponent } from '../maps/location-summary/location-summary.component';
import type { Hazard, HazardProfile, LocationPin } from '@pac-api/client';
import { CdpLogoIconComponent, WarningIconComponent } from '../../shared/icons';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import { DisclosureTrendsComponent } from '../location-card/disclosure-trends/disclosure-trends.component';
import { DisclosureTrendsStatsService } from '../location-card/disclosure-trends/disclosure-trends-stats.service';
import type { DisclosureTrendsSummary } from '../location-card/disclosure-trends/disclosure-trends.stats';
import { Footer } from '../../core/footer/footer';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { buildOrganizationSlugSegment } from '../../shared/utils/org-slug.util';

type LocationRouteTarget = {
  organizationId: number;
  name: string;
  country?: string;
  countryName?: string;
  slug?: string;
};

@Component({
  selector: 'app-main-search',
  templateUrl: './main-search.html',
  styleUrls: ['./main-search.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-y-auto' },
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ReactiveFormsModule,
    TranslateModule,
    Maps,
    LocationSummaryComponent,
    CdpLogoIconComponent,
    WarningIconComponent,
    AppHeaderComponent,
    DisclosureTrendsComponent,
    Footer,
  ],
})
export class MainSearchComponent implements OnInit {
  searchControl = new FormControl('');
  isNotFound = false;
  isOverlayOpen = false;
  // Session-only: when the user dismisses the intro card it stays gone for the
  // current page load and reappears on reload. No persistence by design.
  isInfoCardDismissed = false;
  allLocations: LocationSuggestion[] = [];
  // Cached default-suggestion ordering: A-list reporters first, then everyone else,
  // each group uniformly shuffled once per page load
  private defaultSuggestions: LocationSuggestion[] = [];
  filteredLocations!: Observable<LocationSuggestion[]>;
  private readonly allLocations$ = new BehaviorSubject<LocationSuggestion[]>([]);
  activeSuggestionIndex = -1;
  private visibleSuggestions: LocationSuggestion[] = [];
  selectedMapCategoryFilter: MapCategoryFilter = 'all';

  selectedLocation: LocationPin | null = null;
  selectedLocationData: LocationData | null = null;
  isLoadingHazardData = false;

  readonly disclosureTrendsYear = 2025;
  disclosureTrendsSummary!: Observable<DisclosureTrendsSummary>;
  totalHazardsCount = 0;
  disclosedActionsCount = 0;
  projectsRequiringFundingCount = 0;
  topFourHazards: Hazard[] = [];

  @ViewChild('overlayInput') private overlayInputRef?: ElementRef<HTMLInputElement>;

  private destroyRef = inject(DestroyRef);

  constructor(
    private searchService: SearchService,
    private locationService: LocationService,
    private mapSelectionService: MapSelectionService,
    private router: Router,
    private disclosureTrendsStatsService: DisclosureTrendsStatsService,
    private posthog: AnalyticsService,
  ) {}

  ngOnInit() {
    this.disclosureTrendsSummary = this.disclosureTrendsStatsService.getSummary(
      this.disclosureTrendsYear,
    );

    this.filteredLocations = combineLatest([
      this.searchControl.valueChanges.pipe(
        startWith(this.searchControl.value || ''),
        tap(() => {
          this.activeSuggestionIndex = -1;
          this.onInput();
        }),
      ),
      this.allLocations$,
    ]).pipe(
      map(([value, locations]) => this._filter(value || '', locations)),
      tap((locations) => {
        this.visibleSuggestions = locations;
        if (this.activeSuggestionIndex >= locations.length) {
          this.activeSuggestionIndex = locations.length - 1;
        }
      }),
      takeUntilDestroyed(this.destroyRef),
    );

    this.locationService
      .getAllLocationNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (names) => {
          this.allLocations = names;
          this.defaultSuggestions = [...names]
            .map((loc) => ({ loc, group: loc.isReportingLeader ? 0 : 1, key: Math.random() }))
            .sort((a, b) => a.group - b.group || a.key - b.key)
            .map((entry) => entry.loc);
          this.allLocations$.next(names);
        },
      });

    this.mapSelectionService.selectedMapLocation$
      .pipe(
        tap((location) => {
          this.selectedLocation = location;
          if (location) {
            this.totalHazardsCount = 0;
            this.disclosedActionsCount = 0;
            this.projectsRequiringFundingCount = 0;
            this.topFourHazards = [];
            this.isLoadingHazardData = true;
          }
        }),
        filter((location): location is LocationPin => location !== null),
        switchMap((location) =>
          this.searchService.searchLocation(location.name).pipe(
            tap(() => (this.isLoadingHazardData = false)),
            catchError((err) => {
              console.error('Error fetching location details:', err);
              this.isLoadingHazardData = false;
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (data) {
          this.processLocationData(data);
        }
      });
  }

  get resolvedYear(): number {
    return this.selectedLocationData?.disclosureYear ?? new Date().getFullYear();
  }

  get selectedLocationDisplay(): LocationPin | null {
    if (!this.selectedLocation) {
      return null;
    }

    return {
      ...this.selectedLocation,
      name: this.selectedLocationData?.name ?? this.selectedLocation.name,
    };
  }

  private processLocationData(data: LocationData): void {
    this.selectedLocationData = data;
    this.totalHazardsCount = data.hazards?.hazards?.length || 0;
    this.disclosedActionsCount = data.governmentActions?.actions?.length || 0;
    this.projectsRequiringFundingCount = data.governmentActions?.projects?.length || 0;
    this.topFourHazards = (data.hazards?.hazards || [])
      .map((hazardProfile: HazardProfile) => hazardProfile.hazard)
      .slice(0, 4);
  }

  closeCard(): void {
    this.mapSelectionService.clearSelection();
    this.selectedLocationData = null;
  }

  goToLocationDetails(): void {
    if (!this.selectedLocation) {
      return;
    }
    const suggestion = this.allLocations.find((loc) => loc.name === this.selectedLocation?.name);
    if (suggestion) {
      this.posthog.capture('search_location_selected', {
        location_id: suggestion.organizationId,
        location_name: suggestion.name,
        country: suggestion.country,
        source: 'map_pin',
      });
      this.mapSelectionService.clearSelection();
      this.openLocation(suggestion);
    }
  }

  openSearchOverlay(): void {
    if (this.isOverlayOpen) {
      return;
    }
    this.isOverlayOpen = true;
    requestAnimationFrame(() => {
      this.overlayInputRef?.nativeElement.focus();
    });
  }

  closeSearchOverlay(): void {
    this.isOverlayOpen = false;
  }

  dismissInfoCard(): void {
    this.isInfoCardDismissed = true;
  }

  setMapCategoryFilter(filter: Exclude<MapCategoryFilter, 'all'>): void {
    const nextFilter: MapCategoryFilter =
      this.selectedMapCategoryFilter === filter ? 'all' : filter;
    this.selectedMapCategoryFilter = nextFilter;
    this.posthog.capture('map_category_filter_selected', {
      category: nextFilter,
      source: 'homepage_legend',
    });
  }

  scrollToTrends(): void {
    document
      .querySelector('app-disclosure-trends')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOverlayOpen) {
      this.closeSearchOverlay();
    }
  }

  onInput(): void {
    if (this.isNotFound) {
      this.isNotFound = false;
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActiveSuggestion(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActiveSuggestion(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedSuggestion =
        this.visibleSuggestions[this.activeSuggestionIndex] ?? this.visibleSuggestions[0];
      if (selectedSuggestion) {
        this.onSearch(selectedSuggestion.name);
        return;
      }

      this.onSearch();
    }
  }

  setActiveSuggestion(index: number): void {
    this.activeSuggestionIndex = index;
  }

  getSuggestionId(index: number): string {
    return `search-suggestion-${index}`;
  }

  get activeSuggestionId(): string | null {
    return this.activeSuggestionIndex >= 0
      ? this.getSuggestionId(this.activeSuggestionIndex)
      : null;
  }

  splitMatch(name: string, query: string): Array<{ text: string; bold: boolean }> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return [{ text: name, bold: false }];
    }
    // Strip-only (no abbrev expansion) so indexes line up with `name`.
    const strippedName = stripDiacritics(name);
    const strippedQuery = stripDiacritics(trimmed);
    const idx = strippedName.indexOf(strippedQuery);
    if (idx === -1) {
      return [{ text: name, bold: false }];
    }
    return [
      { text: name.substring(0, idx), bold: false },
      { text: name.substring(idx, idx + strippedQuery.length), bold: true },
      { text: name.substring(idx + strippedQuery.length), bold: false },
    ];
  }

  private static readonly MAX_SUGGESTIONS = 5;

  private _filter(
    value: string,
    locations: LocationSuggestion[] = this.allLocations,
  ): LocationSuggestion[] {
    return filterLocationSuggestions(
      value,
      locations,
      MainSearchComponent.MAX_SUGGESTIONS,
      this.defaultSuggestions,
    );
  }

  private moveActiveSuggestion(step: 1 | -1): void {
    if (this.visibleSuggestions.length === 0) {
      this.activeSuggestionIndex = -1;
      return;
    }

    const nextIndex = this.activeSuggestionIndex + step;
    if (nextIndex < 0) {
      this.activeSuggestionIndex = this.visibleSuggestions.length - 1;
      return;
    }

    if (nextIndex >= this.visibleSuggestions.length) {
      this.activeSuggestionIndex = 0;
      return;
    }

    this.activeSuggestionIndex = nextIndex;
  }

  onSearch(query?: string) {
    const searchQuery = query || this.searchControl.value;
    if (!searchQuery || !searchQuery.trim()) {
      return;
    }

    const trimmedQuery = searchQuery.trim();
    // Accent-insensitive so "Sao Paulo" resolves to "São Paulo".
    const normalizedQuery = normalizeLocationSearch(trimmedQuery);
    const selectedLocation = this.allLocations.find(
      (location) => normalizeLocationSearch(location.name) === normalizedQuery,
    );

    if (selectedLocation) {
      const resultRank =
        this.visibleSuggestions.findIndex(
          (location) => location.organizationId === selectedLocation.organizationId,
        ) + 1;
      this.posthog.capture('search_location_selected', {
        location_id: selectedLocation.organizationId,
        location_name: selectedLocation.name,
        country: selectedLocation.country,
        source: 'search',
        query_length: trimmedQuery.length,
        result_rank: resultRank || undefined,
      });
      this.openLocation(selectedLocation);
    } else {
      this.loadLocation(trimmedQuery);
    }
  }

  onBackHome() {
    this.searchControl.setValue('');
    this.isNotFound = false;
    this.mapSelectionService.clearSelection();
    this.router.navigate(['/']);
  }

  private openLocation(location: LocationRouteTarget) {
    this.closeSearchOverlay();
    const country = location.country ?? location.countryName;
    const slug =
      location.slug ??
      buildOrganizationSlugSegment(location.organizationId, location.name, country);

    this.router.navigate(['/org', slug]);
  }

  private loadLocation(locationName: string) {
    this.mapSelectionService.clearSelection();
    this.isNotFound = false;
    this.searchService
      .searchLocation(locationName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.posthog.capture('search_location_selected', {
            location_id: data.organizationId,
            location_name: data.name,
            country: data.countryName,
            source: 'search',
            query_length: locationName.length,
          });
          this.openLocation(data);
        },
        error: () => {
          this.isNotFound = true;
          this.closeSearchOverlay();
        },
      });
  }
}
