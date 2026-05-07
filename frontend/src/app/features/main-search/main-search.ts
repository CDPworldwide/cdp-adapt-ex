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
import fuzzysort from 'fuzzysort';
import { Router } from '@angular/router';
import { SearchService, LocationData } from './search.service';
import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { MapSelectionService } from './map-selection.service';
import { Maps } from '../maps/maps';
import { LocationSummaryComponent } from '../maps/location-summary/location-summary.component';
import type { Hazard, HazardProfile, LocationPin } from '@pac-api/client';
import { CdpLogoIconComponent } from '../../shared/icons';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import { DisclosureTrendsComponent } from '../location-card/disclosure-trends/disclosure-trends.component';
import { DisclosureTrendsStatsService } from '../location-card/disclosure-trends/disclosure-trends-stats.service';
import type { DisclosureTrendsSummary } from '../location-card/disclosure-trends/disclosure-trends.stats';
import { WelcomeModalComponent } from '../welcome-modal/welcome-modal.component';

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
    AppHeaderComponent,
    DisclosureTrendsComponent,
    WelcomeModalComponent,
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
  filteredLocations!: Observable<LocationSuggestion[]>;
  private readonly allLocations$ = new BehaviorSubject<LocationSuggestion[]>([]);

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
  ) {}

  ngOnInit() {
    this.disclosureTrendsSummary = this.disclosureTrendsStatsService.getSummary(
      this.disclosureTrendsYear,
    );

    this.filteredLocations = combineLatest([
      this.searchControl.valueChanges.pipe(startWith(this.searchControl.value || '')),
      this.allLocations$,
    ]).pipe(
      map(([value, locations]) => this._filter(value || '', locations)),
      takeUntilDestroyed(this.destroyRef),
    );

    this.locationService
      .getAllLocationNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (names) => {
          this.allLocations = names;
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
      this.mapSelectionService.clearSelection();
      this.router.navigate(['/org', suggestion.organizationId]);
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

  splitMatch(name: string, query: string): Array<{ text: string; bold: boolean }> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return [{ text: name, bold: false }];
    }
    const idx = name.toLowerCase().indexOf(trimmed.toLowerCase());
    if (idx === -1) {
      return [{ text: name, bold: false }];
    }
    return [
      { text: name.substring(0, idx), bold: false },
      { text: name.substring(idx, idx + trimmed.length), bold: true },
      { text: name.substring(idx + trimmed.length), bold: false },
    ];
  }

  private static readonly MAX_SUGGESTIONS = 5;

  private normalizeForSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\bst\.?\b/gi, 'saint')
      .replace(/\bste\.?\b/gi, 'sainte')
      .replace(/\bmt\.?\b/gi, 'mount')
      .replace(/\bft\.?\b/gi, 'fort')
      .toLowerCase();
  }

  private _filter(
    value: string,
    locations: LocationSuggestion[] = this.allLocations,
  ): LocationSuggestion[] {
    if (!value) {
      return locations.slice(0, MainSearchComponent.MAX_SUGGESTIONS);
    }
    // Search both name and country so a query like "thailand" surfaces every
    // Thai jurisdiction even though it doesn't appear in their names.
    const prepared = locations.map((loc) => ({
      ...loc,
      _normalizedName: this.normalizeForSearch(loc.name),
      _normalizedCountry: loc.country ? this.normalizeForSearch(loc.country) : '',
    }));
    const results = fuzzysort.go(this.normalizeForSearch(value), prepared, {
      keys: ['_normalizedName', '_normalizedCountry'],
      limit: MainSearchComponent.MAX_SUGGESTIONS,
    });
    return results.map((result) => {
      const { _normalizedName, _normalizedCountry, ...rest } = result.obj;
      return rest;
    });
  }

  onSearch(query?: string) {
    const searchQuery = query || this.searchControl.value;
    if (!searchQuery || !searchQuery.trim()) {
      return;
    }

    const trimmedQuery = searchQuery.trim();
    const selectedLocation = this.allLocations.find(
      (location) => location.name.toLowerCase() === trimmedQuery.toLowerCase(),
    );

    if (selectedLocation) {
      this.openLocation(selectedLocation.organizationId);
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

  private openLocation(organizationId: number) {
    this.closeSearchOverlay();
    this.router.navigate(['/org', organizationId]);
  }

  private loadLocation(locationName: string) {
    this.mapSelectionService.clearSelection();
    this.isNotFound = false;
    this.searchService
      .searchLocation(locationName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.openLocation(data.organizationId);
        },
        error: () => {
          this.isNotFound = true;
          this.closeSearchOverlay();
        },
      });
  }
}
