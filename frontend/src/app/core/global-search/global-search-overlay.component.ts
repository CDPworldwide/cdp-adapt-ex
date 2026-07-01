import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import fuzzysort from 'fuzzysort';
import { BehaviorSubject, Observable, combineLatest, of, startWith } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { SearchService } from '../../features/main-search/search.service';
import {
  COUNTRY_ALIASES,
  LOCATION_SEARCH_KEYWORDS,
  SEARCH_ALIASES,
} from '../../features/main-search/search-aliases';
import { STATE_ABBREV_TO_NAME } from '../../features/main-search/state-abbrev';
import { PosthogService } from '../analytics/posthog.service';
import { CdpLogoIconComponent, WarningIconComponent } from '../../shared/icons';
import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { GlobalSearchService } from './global-search.service';

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-global-search-overlay',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    TranslateModule,
    CdpLogoIconComponent,
    WarningIconComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-40 bg-black/95 transition-opacity duration-300"
      [ngClass]="isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      (click)="close()"
      aria-hidden="true"
    ></div>

    <div
      class="fixed inset-0 z-50 flex flex-col items-center pt-20 px-6 md:px-12 transition-opacity duration-300 overflow-y-auto pointer-events-none"
      [ngClass]="isOpen ? 'opacity-100' : 'opacity-0'"
      role="dialog"
      aria-modal="true"
      [attr.aria-hidden]="!isOpen"
    >
      <div class="w-full max-w-3xl" [class.pointer-events-auto]="isOpen">
        <div class="text-center">
          <span class="text-xs uppercase tracking-cdp-eyebrow text-white/80 font-medium">
            {{ 'homepage.hero.title' | translate }}
          </span>
        </div>

        <div class="mt-6 flex items-center gap-4">
          <mat-icon class="text-white !text-[28px] !w-7 !h-7 flex-shrink-0">search</mat-icon>
          <input
            #searchInput
            type="text"
            class="flex-1 min-w-0 bg-transparent text-white text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-none border-none outline-none caret-white"
            [formControl]="searchControl"
            role="combobox"
            aria-autocomplete="list"
            [attr.aria-expanded]="isOpen"
            aria-controls="global-search-suggestions"
            [attr.aria-activedescendant]="activeSuggestionId"
            (keydown)="onSearchKeydown($event)"
          />
        </div>

        <div class="mt-10 ml-0 md:ml-14">
          @if (filteredLocations | async; as results) {
            @if (results.length === 0 && (searchControl.value || '').trim().length > 0) {
              <div
                class="py-4 text-white/80 text-xl md:text-2xl font-light"
                role="status"
                aria-live="polite"
              >
                {{ 'homepage.hero.noResults' | translate: { query: searchControl.value } }}
              </div>
            } @else {
              <span class="text-xs uppercase tracking-cdp-eyebrow text-white/60 font-medium">
                {{ 'homepage.hero.searchSuggestions' | translate }}
              </span>
              <ul
                id="global-search-suggestions"
                class="mt-4 divide-y divide-white/10"
                role="listbox"
              >
                @for (option of results; track option.organizationId; let index = $index) {
                  <li>
                    <button
                      [id]="getSuggestionId(index)"
                      type="button"
                      role="option"
                      [attr.aria-selected]="activeSuggestionIndex === index"
                      class="w-full py-4 px-2 -mx-2 rounded-sm flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cdp-red transition-colors"
                      [ngClass]="{ 'bg-white/10': activeSuggestionIndex === index }"
                      (mouseenter)="setActiveSuggestion(index)"
                      (click)="onSearch(option.name)"
                    >
                      <span class="flex flex-col text-left">
                        <span class="text-white text-2xl md:text-3xl font-light">
                          @for (
                            part of splitMatch(option.name, searchControl.value || '');
                            track $index
                          ) {
                            <span [class.font-bold]="part.bold">{{ part.text }}</span>
                          }
                        </span>
                        @if (option.country) {
                          <span class="text-white/60 text-sm font-light mt-0.5">
                            @for (
                              part of splitMatch(option.country, searchControl.value || '');
                              track $index
                            ) {
                              <span [class.font-medium]="part.bold">{{ part.text }}</span>
                            }
                          </span>
                        }
                      </span>
                      @if (option.disclosesToCDP) {
                        <app-cdp-logo-icon class="text-white shrink-0"></app-cdp-logo-icon>
                      } @else {
                        <span class="inline-flex items-center justify-center w-4 h-4 shrink-0">
                          <app-warning-icon
                            size="16"
                            color="currentColor"
                            class="text-white"
                          ></app-warning-icon>
                        </span>
                      }
                    </button>
                  </li>
                }
              </ul>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class GlobalSearchOverlayComponent implements OnInit {
  private static readonly MAX_SUGGESTIONS = 5;

  readonly searchControl = new FormControl('');
  filteredLocations!: Observable<LocationSuggestion[]>;
  isOpen = false;
  activeSuggestionIndex = -1;

  private allLocations: LocationSuggestion[] = [];
  private defaultSuggestions: LocationSuggestion[] = [];
  private visibleSuggestions: LocationSuggestion[] = [];
  private readonly allLocations$ = new BehaviorSubject<LocationSuggestion[]>([]);
  private readonly destroyRef = inject(DestroyRef);
  private readonly globalSearchService = inject(GlobalSearchService);
  private readonly locationService = inject(LocationService);
  private readonly posthog = inject(PosthogService);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);

  @ViewChild('searchInput') private searchInputRef?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.filteredLocations = combineLatest([
      this.searchControl.valueChanges.pipe(
        startWith(this.searchControl.value || ''),
        tap(() => {
          this.activeSuggestionIndex = -1;
        }),
      ),
      this.allLocations$,
    ]).pipe(
      map(([value, locations]) => this.filterLocations(value || '', locations)),
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
      .subscribe((names) => {
        this.allLocations = names;
        this.defaultSuggestions = [...names]
          .map((loc) => ({ loc, group: loc.isReportingLeader ? 0 : 1, key: Math.random() }))
          .sort((a, b) => a.group - b.group || a.key - b.key)
          .map((entry) => entry.loc);
        this.allLocations$.next(names);
      });

    this.globalSearchService.openRequested$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.open());
  }

  open(): void {
    if (this.isOpen) {
      this.focusInput();
      return;
    }

    this.isOpen = true;
    this.searchControl.setValue('');
    this.focusInput();
  }

  close(): void {
    this.isOpen = false;
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

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

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  setActiveSuggestion(index: number): void {
    this.activeSuggestionIndex = index;
  }

  getSuggestionId(index: number): string {
    return `global-search-suggestion-${index}`;
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

  onSearch(query?: string): void {
    const searchQuery = query || this.searchControl.value;
    if (!searchQuery || !searchQuery.trim()) {
      return;
    }

    const trimmedQuery = searchQuery.trim();
    const normalizedQuery = this.normalizeForSearch(trimmedQuery);
    const selectedLocation = this.allLocations.find(
      (location) => this.normalizeForSearch(location.name) === normalizedQuery,
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
        source: 'global_search',
        query_length: trimmedQuery.length,
        result_rank: resultRank || undefined,
      });
      this.openLocation(selectedLocation.organizationId);
      return;
    }

    this.searchService
      .searchLocation(trimmedQuery)
      .pipe(
        switchMap((data) => {
          this.posthog.capture('search_location_selected', {
            location_id: data.organizationId,
            location_name: data.name,
            country: data.countryName,
            source: 'global_search',
            query_length: trimmedQuery.length,
          });
          this.openLocation(data.organizationId);
          return of(data);
        }),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private focusInput(): void {
    requestAnimationFrame(() => {
      this.searchInputRef?.nativeElement.focus();
    });
  }

  private openLocation(organizationId: number): void {
    this.close();
    this.router.navigate(['/org', organizationId]);
  }

  private normalizeForSearch(value: string): string {
    const base = stripDiacritics(value)
      .replace(/\bst\.?\b/gi, 'saint')
      .replace(/\bste\.?\b/gi, 'sainte')
      .replace(/\bmt\.?\b/gi, 'mount')
      .replace(/\bft\.?\b/gi, 'fort')
      .toLowerCase()
      .replace(/[.,()'"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return SEARCH_ALIASES[base] ?? COUNTRY_ALIASES[base] ?? base;
  }

  private buildSearchHaystack(name: string): string {
    const normalized = this.normalizeForSearch(name);
    const m = name.match(/,\s*([A-Z]{2,3})\s*$/);
    const expansion = m ? STATE_ABBREV_TO_NAME[m[1]] : undefined;
    const extra = LOCATION_SEARCH_KEYWORDS[normalized];
    return [normalized, expansion && this.normalizeForSearch(expansion), extra]
      .filter(Boolean)
      .join(' ');
  }

  private filterLocations(value: string, locations: LocationSuggestion[]): LocationSuggestion[] {
    if (!value) {
      return this.defaultSuggestions.slice(0, GlobalSearchOverlayComponent.MAX_SUGGESTIONS);
    }

    const prepared = locations.map((loc) => ({
      ...loc,
      _normalizedName: this.buildSearchHaystack(loc.name),
      _normalizedCountry: loc.country ? this.normalizeForSearch(loc.country) : '',
    }));
    const results = fuzzysort.go(this.normalizeForSearch(value), prepared, {
      keys: ['_normalizedName', '_normalizedCountry'],
      limit: GlobalSearchOverlayComponent.MAX_SUGGESTIONS,
    });
    return results.map((result) => {
      const { _normalizedName, _normalizedCountry, ...rest } = result.obj;
      return rest;
    });
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
}
