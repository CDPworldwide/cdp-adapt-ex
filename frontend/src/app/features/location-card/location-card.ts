import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnInit,
  SimpleChanges,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { GovernmentActionsComponent } from './government-actions/government-actions.component';
import { HazardsComponent } from './hazards/hazards.component';
import { HazardMapComponent } from '../hazard-map/hazard-map';
import { InfoIconComponent } from '../../shared/icons';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GeometryService } from '../../shared/services/geometry.service';
import type { AdaptationAction, Hazard, LocationProfile } from '@pac-api/client';
import { SolutionsComponent } from './solutions/solutions.component';
import { ReplaySubject, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Footer } from '../../core/footer/footer';

import {
  buildHazardActionFilter,
  DEFAULT_LOCATION_CARD_TAB,
  shouldClearHazardFilter,
  type LocationCardTabKey,
} from './location-card-tabs';

export type LocationData = LocationProfile;
export type { LocationCardTabKey } from './location-card-tabs';

declare let gtag: Function;

@Component({
  selector: 'app-location-card',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    TranslateModule,
    GovernmentActionsComponent,
    HazardsComponent,
    HazardMapComponent,
    MatTooltipModule,
    InfoIconComponent,
    MatProgressSpinnerModule,
    SolutionsComponent,
    Footer,
  ],
  templateUrl: './location-card.html',
  styleUrls: ['./location-card.css'],
})
export class LocationCardComponent implements OnChanges, OnInit {
  @Input()
  data: LocationData | null = null;

  @Output()
  backToMap = new EventEmitter<void>();

  @Output()
  activeTabChange = new EventEmitter<LocationCardTabKey>();

  @Input()
  activeTab: LocationCardTabKey = DEFAULT_LOCATION_CARD_TAB;
  selectedHazardFilter: string | null = null;
  jurisdictionBounds?: google.maps.LatLngBounds;

  private lastTrackedLocationName: string | null = null;
  private geometry$ = new ReplaySubject<{ [key: string]: unknown } | undefined>(1);

  constructor(
    private geometryService: GeometryService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.geometry$
      .pipe(
        switchMap((geometry) => {
          if (!geometry) {
            return of(undefined);
          }
          return this.geometryService.calculateBounds(geometry);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((bounds) => {
        this.jurisdictionBounds = bounds;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue) {
      this.selectedHazardFilter = null;

      const currentData = changes['data'].currentValue as LocationData;
      // Only fire tracking if data represents a full profile (includes hazards)
      // and prevent duplicate firing for the same location name
      if (
        currentData.name &&
        currentData.hazards &&
        this.lastTrackedLocationName !== currentData.name
      ) {
        this.lastTrackedLocationName = currentData.name;
        if (typeof gtag === 'function') {
          gtag('event', 'location_viewed', { location_id: currentData.name });
        }
      }

      // Push the new geometry to the stream
      this.geometry$.next(currentData.geometry);
    }

    if (changes['activeTab'] && shouldClearHazardFilter(changes['activeTab'].currentValue)) {
      this.selectedHazardFilter = null;
    }
  }

  setActiveTab(tab: LocationCardTabKey): void {
    this.updateActiveTab(tab);
  }

  private updateActiveTab(tab: LocationCardTabKey): void {
    this.activeTab = tab;
    if (shouldClearHazardFilter(tab)) {
      this.selectedHazardFilter = null;
    }
    this.activeTabChange.emit(tab);
  }

  goBackToMap(): void {
    this.backToMap.emit();
  }

  exploreHazardActions(hazard: Hazard): void {
    this.selectedHazardFilter = buildHazardActionFilter(hazard);
    this.updateActiveTab('actions');
    const scrollable = document.getElementById('page-content')?.parentElement;
    scrollable?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatPopulation(value: number | null | undefined): string {
    if (value == null) return '';
    if (value >= 1_000_000) {
      const millions = value / 1_000_000;
      return `${millions.toFixed(millions >= 10 ? 0 : 1)} million`;
    }
    if (value >= 1_000) {
      const thousands = value / 1_000;
      return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
    }
    return value.toString();
  }
}
