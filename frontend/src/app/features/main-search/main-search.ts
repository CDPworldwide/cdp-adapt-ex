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
import { ActionStatusEnum } from '@pac-api/client';
import type { AdaptationAction, Hazard, HazardProfile, LocationPin } from '@pac-api/client';
import { CdpLogoIconComponent } from '../../shared/icons';
import { AppHeaderComponent } from '../../shared/app-header/app-header';

@Component({
  selector: 'app-main-search',
  templateUrl: './main-search.html',
  styleUrls: ['./main-search.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'flex flex-col flex-1 min-h-0' },
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
  ],
})
export class MainSearchComponent implements OnInit {
  searchControl = new FormControl('');
  isNotFound = false;
  isOverlayOpen = false;
  allLocations: LocationSuggestion[] = [];
  filteredLocations!: Observable<LocationSuggestion[]>;
  private readonly allLocations$ = new BehaviorSubject<LocationSuggestion[]>([]);

  selectedLocation: LocationPin | null = null;
  isLoadingHazardData = false;
  totalHazardsCount = 0;
  implementedActionsCount = 0;
  projectsRequiringFundingCount = 0;
  topFourHazards: Hazard[] = [];

  @ViewChild('overlayInput') private overlayInputRef?: ElementRef<HTMLInputElement>;

  private destroyRef = inject(DestroyRef);

  constructor(
    private searchService: SearchService,
    private locationService: LocationService,
    private mapSelectionService: MapSelectionService,
    private router: Router,
  ) {}

  ngOnInit() {
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
            this.implementedActionsCount = 0;
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

  private processLocationData(data: LocationData): void {
    this.totalHazardsCount = data.hazards?.hazards?.length || 0;
    this.implementedActionsCount =
      data.governmentActions?.actions?.filter(
        (action: AdaptationAction) =>
          action.status?.statusType === ActionStatusEnum.ACTION_IN_OPERATION_JURISDICTION_WIDE ||
          action.status?.statusType === ActionStatusEnum.ACTION_IN_OPERATION_MOST_OF_JURISDICTION ||
          action.status?.statusType === ActionStatusEnum.ACTION_IN_OPERATION_TARGETED,
      ).length || 0;
    this.projectsRequiringFundingCount = data.governmentActions?.projects?.length || 0;
    this.topFourHazards = (data.hazards?.hazards || [])
      .map((hazardProfile: HazardProfile) => hazardProfile.hazard)
      .slice(0, 4);
  }

  closeCard(): void {
    this.mapSelectionService.clearSelection();
  }

  goToLocationDetails(): void {
    if (!this.selectedLocation) {
      return;
    }
    const suggestion = this.allLocations.find(
      (loc) => loc.name === this.selectedLocation?.name,
    );
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
    const prepared = locations.map((loc) => ({
      ...loc,
      _normalized: this.normalizeForSearch(loc.name),
    }));
    const results = fuzzysort.go(this.normalizeForSearch(value), prepared, {
      key: '_normalized',
      limit: MainSearchComponent.MAX_SUGGESTIONS,
    });
    return results.map((result) => {
      const { _normalized, ...rest } = result.obj;
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
