import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
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
import {
  getEdgeCaseBannerVariant,
  type EdgeCaseBannerVariant,
} from './edge-case-banner/edge-case-banner.util';
import { ReplaySubject, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Footer } from '../../core/footer/footer';
import { PosthogService } from '../../core/analytics/posthog.service';
import { ReportingLeaderChipComponent } from '../../shared/components/reporting-leader-chip/reporting-leader-chip.component';
import {
  hazardKeyProperties,
  hazardProperties,
  locationProperties,
} from '../../core/analytics/analytics-events';

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
    ReportingLeaderChipComponent,
  ],
  templateUrl: './location-card.html',
  styleUrls: ['./location-card.css'],
})
export class LocationCardComponent implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  @Input()
  data: LocationData | null = null;

  @Output()
  backToMap = new EventEmitter<void>();

  @Output()
  activeTabChange = new EventEmitter<LocationCardTabKey>();

  @Output()
  actionHazardFilterChange = new EventEmitter<string | null>();

  @Input()
  activeTab: LocationCardTabKey = DEFAULT_LOCATION_CARD_TAB;
  selectedHazardFilter: string | null = null;
  jurisdictionBounds?: google.maps.LatLngBounds;

  // GEE-derived jurisdictions are CDP analysis-only (no disclosed
  // questionnaire), so the Government actions tab — which is sourced entirely
  // from disclosed actions/goals/projects — is hidden for them.
  get showGovernmentActionsTab(): boolean {
    return this.data?.publicStatus !== 'GEE-Derived';
  }

  // Shared with the Government actions tab so it shows the same banner as Hazards.
  get edgeCaseBannerVariant(): EdgeCaseBannerVariant {
    return getEdgeCaseBannerVariant(this.data?.publicStatus, this.data?.hazards?.hazards);
  }

  isStickyHeaderVisible = false;

  @ViewChild('stickyTrigger')
  private stickyTrigger?: ElementRef<HTMLElement>;
  private scrollRoot?: HTMLElement;
  private scrollHandler?: () => void;

  private lastTrackedLocationName: string | null = null;
  private geometry$ = new ReplaySubject<{ [key: string]: unknown } | undefined>(1);

  constructor(
    private geometryService: GeometryService,
    private destroyRef: DestroyRef,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private posthog: PosthogService,
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

  ngAfterViewInit(): void {
    if (!this.stickyTrigger) return;
    const scrollRoot = this.findScrollableParent(this.stickyTrigger.nativeElement);
    if (!scrollRoot) return;
    this.scrollRoot = scrollRoot;
    this.zone.runOutsideAngular(() => {
      this.scrollHandler = () => this.checkStickyHeaderVisibility();
      scrollRoot.addEventListener('scroll', this.scrollHandler, { passive: true });
      this.checkStickyHeaderVisibility();
    });
  }

  ngOnDestroy(): void {
    if (this.scrollHandler) {
      this.scrollRoot?.removeEventListener('scroll', this.scrollHandler);
    }
  }

  private checkStickyHeaderVisibility(): void {
    if (!this.stickyTrigger) return;
    const shouldShow = this.stickyTrigger.nativeElement.getBoundingClientRect().top < 0;
    if (shouldShow !== this.isStickyHeaderVisible) {
      this.zone.run(() => {
        this.isStickyHeaderVisible = shouldShow;
        this.cdr.markForCheck();
      });
    }
  }

  private findScrollableParent(el: HTMLElement): HTMLElement | null {
    let parent: HTMLElement | null = el.parentElement;
    while (parent && parent !== document.documentElement) {
      const overflowY = window.getComputedStyle(parent).overflowY;
      const scrollableOverflow =
        overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
      if (scrollableOverflow && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && changes['data'].currentValue) {
      this.updateSelectedHazardFilter(null, false);

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
        this.posthog.capture('location_viewed', locationProperties(currentData));
      }

      // Push the new geometry to the stream
      this.geometry$.next(currentData.geometry);

      // If we just landed on a GEE-derived location while the Government
      // actions tab is selected (e.g. via a deep link), fall back to Hazards.
      if (this.activeTab === 'actions' && currentData.publicStatus === 'GEE-Derived') {
        this.updateActiveTab('hazards');
      }
    }

    if (changes['activeTab'] && shouldClearHazardFilter(changes['activeTab'].currentValue)) {
      this.updateSelectedHazardFilter(null);
    }
  }

  setActiveTab(tab: LocationCardTabKey): void {
    const previousTab = this.activeTab;
    this.updateActiveTab(tab);
    if (previousTab !== tab) {
      this.posthog.capture('location_tab_changed', {
        ...locationProperties(this.data),
        from_tab: previousTab,
        to_tab: tab,
      });
    }
    // Each tab is its own logical "page"; reset scroll so the content
    // doesn't open partway down. Mirrors what `exploreHazardActions` does
    // when it programmatically switches to the actions tab.
    this.scrollRoot?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private updateActiveTab(tab: LocationCardTabKey): void {
    this.activeTab = tab;
    if (shouldClearHazardFilter(tab)) {
      this.updateSelectedHazardFilter(null);
    }
    this.activeTabChange.emit(tab);
  }

  onActionHazardFilterChange(filter: string | null): void {
    this.updateSelectedHazardFilter(filter);
  }

  goBackToMap(): void {
    this.backToMap.emit();
  }

  exploreHazardActions(hazard: Hazard): void {
    const actionCount = this.countActionsForHazard(hazard);
    this.posthog.capture('hazard_actions_explore_clicked', {
      ...locationProperties(this.data),
      ...hazardProperties(hazard),
      action_count: actionCount,
    });
    this.updateSelectedHazardFilter(buildHazardActionFilter(hazard));
    const previousTab = this.activeTab;
    this.updateActiveTab('actions');
    if (previousTab !== 'actions') {
      this.posthog.capture('location_tab_changed', {
        ...locationProperties(this.data),
        from_tab: previousTab,
        to_tab: 'actions',
        source: 'hazard_actions_explore',
      });
    }
    this.scrollRoot?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private updateSelectedHazardFilter(filter: string | null, track = true): void {
    if (this.selectedHazardFilter === filter) {
      return;
    }

    const previousFilter = this.selectedHazardFilter;
    this.selectedHazardFilter = filter;
    this.actionHazardFilterChange.emit(filter);

    if (!track) {
      return;
    }

    if (filter) {
      this.posthog.capture('action_hazard_filter_applied', {
        ...locationProperties(this.data),
        ...hazardKeyProperties(filter),
        matching_action_count: this.countActionsForHazardKey(filter),
      });
      return;
    }

    this.posthog.capture('action_hazard_filter_cleared', {
      ...locationProperties(this.data),
      ...hazardKeyProperties(previousFilter),
    });
  }

  private countActionsForHazardKey(filter: string): number {
    const [hazardType, otherDetails = ''] = filter.split('|');
    return (
      this.data?.governmentActions?.actions?.filter((action) =>
        action.hazardsAddressed?.some(
          (hazard) =>
            hazard.hazardType === hazardType && (hazard.otherHazardDetails || '') === otherDetails,
        ),
      ).length ?? 0
    );
  }

  private countActionsForHazard(hazard: Hazard): number {
    return this.countActionsForHazardKey(buildHazardActionFilter(hazard));
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
