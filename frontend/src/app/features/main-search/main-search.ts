import { Component, DestroyRef, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, Observable, combineLatest, map, startWith } from 'rxjs';
import fuzzysort from 'fuzzysort';
import { Router } from '@angular/router';
import { SearchService, LocationData } from './search.service';
import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { MapSelectionService } from './map-selection.service';
import { Maps } from '../maps/maps';
import { CdpLogoIconComponent, CdpLogoWithTextIconComponent } from '../../shared/icons';
import { LoadingSpinner } from '../../shared/loading-spinner/loading-spinner';
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
    MatAutocompleteModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TranslateModule,
    Maps,
    CdpLogoIconComponent,
    CdpLogoWithTextIconComponent,
    LoadingSpinner,
    AppHeaderComponent,
  ],
})
export class MainSearchComponent implements OnInit {
  searchControl = new FormControl('');
  isNotFound = false;
  isAutocompleteOpen = false;
  isLoadingLocation = false;
  menuOpen = false;
  allLocations: LocationSuggestion[] = [];
  filteredLocations!: Observable<LocationSuggestion[]>;
  private readonly allLocations$ = new BehaviorSubject<LocationSuggestion[]>([]);
  private searchInputHasFocus = false;
  private pendingAutocompleteOpen = false;
  private autocompleteTrigger?: MatAutocompleteTrigger;

  hasMapPinSelected = false;
  isMapClicked = false;
  pinFilter: 'all' | 'city' | 'region' = 'all';

  get isMapFocused(): boolean {
    return this.hasMapPinSelected || this.isMapClicked;
  }

  private destroyRef = inject(DestroyRef);

  togglePinFilter(type: 'city' | 'region') {
    this.pinFilter = this.pinFilter === type ? 'all' : type;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

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
          this.openAutocompleteIfPending();
        },
      });

    combineLatest({
      location: this.mapSelectionService.selectedMapLocation$,
      isMapClicked: this.mapSelectionService.isMapClicked$,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ location, isMapClicked }) => {
        this.hasMapPinSelected = location !== null;
        this.isMapClicked = isMapClicked;
      });
  }

  onSearchInputInteraction(source: 'focus' | 'click', trigger: MatAutocompleteTrigger): void {
    this.searchInputHasFocus = true;
    this.autocompleteTrigger = trigger;

    this.logAutocompleteDebug('input_interaction', {
      source,
      hasMapPinSelected: this.hasMapPinSelected,
      isAutocompleteOpen: this.isAutocompleteOpen,
      currentValue: this.searchControl.value || '',
      suggestionCount: this._filter(this.searchControl.value || '').length,
      panelOpen: trigger.panelOpen,
    });

    this.openAutocomplete(trigger, source);
  }

  onSearchInputBlur(): void {
    this.searchInputHasFocus = false;
    this.pendingAutocompleteOpen = false;
  }

  onInput(): void {
    if (this.isNotFound) {
      this.isNotFound = false;
    }
  }

  onAutocompleteOpened(): void {
    this.isAutocompleteOpen = true;
    this.logAutocompleteDebug('panel_opened', {
      currentValue: this.searchControl.value || '',
    });
  }

  onAutocompleteClosed(): void {
    this.isAutocompleteOpen = false;
    this.logAutocompleteDebug('panel_closed', {
      currentValue: this.searchControl.value || '',
    });
  }

  /*
   * Filters the location suggestions based on the user's input.
   * When the input is empty, it returns the first 3 locations from the full list.
   * When there is input, it performs a fuzzy search and returns the top 3 matches.
   */
  private _filter(
    value: string,
    locations: LocationSuggestion[] = this.allLocations,
  ): LocationSuggestion[] {
    if (!value) {
      return locations.slice(0, 3);
    }
    const results = fuzzysort.go(value, locations, {
      key: 'name',
      limit: 3,
    });
    return results.map((result) => result.obj);
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

    // Directly open the location if there's a match. Otherwise, perform the search which may lead to a "not found" state.
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
    this.mapSelectionService.setMapClicked(false);
    this.router.navigate(['/']);
  }

  private openLocation(organizationId: number) {
    this.router.navigate(['/org', organizationId]);
  }

  private openAutocomplete(trigger: MatAutocompleteTrigger, source: 'focus' | 'click'): void {
    if (this.isAutocompleteOpen) {
      this.logAutocompleteDebug('skip_open_already_open', {
        source,
        panelOpen: trigger.panelOpen,
      });
      return;
    }

    const suggestionCount = this._filter(this.searchControl.value || '').length;
    if (suggestionCount === 0) {
      this.pendingAutocompleteOpen = this.searchInputHasFocus;
      this.logAutocompleteDebug('skip_open_no_suggestions', {
        source,
        currentValue: this.searchControl.value || '',
      });
      return;
    }

    this.pendingAutocompleteOpen = false;

    this.logAutocompleteDebug('schedule_open', {
      source,
      currentValue: this.searchControl.value || '',
      suggestionCount,
      panelOpen: trigger.panelOpen,
    });

    setTimeout(() => {
      this.logAutocompleteDebug('attempt_open', {
        source,
        currentValue: this.searchControl.value || '',
        suggestionCount: this._filter(this.searchControl.value || '').length,
        panelOpenBefore: trigger.panelOpen,
      });
      trigger.openPanel();
      this.logAutocompleteDebug('open_called', {
        source,
        panelOpenAfter: trigger.panelOpen,
      });
    });
  }

  private openAutocompleteIfPending(): void {
    if (!this.pendingAutocompleteOpen || !this.searchInputHasFocus || !this.autocompleteTrigger) {
      return;
    }

    this.openAutocomplete(this.autocompleteTrigger, 'focus');
  }

  private logAutocompleteDebug(event: string, details: Record<string, unknown>): void {
    console.debug('[MainSearch autocomplete]', {
      event,
      ...details,
    });
  }

  private loadLocation(locationName: string) {
    this.mapSelectionService.clearSelection();
    this.isLoadingLocation = true;
    this.isNotFound = false;
    this.searchService
      .searchLocation(locationName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.isLoadingLocation = false;
          this.openLocation(data.organizationId);
        },
        error: () => {
          this.isLoadingLocation = false;
          this.isNotFound = true;
        },
      });
  }
}
