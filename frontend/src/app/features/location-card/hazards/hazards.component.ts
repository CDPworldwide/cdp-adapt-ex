import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HazardMapComponent, SUPPORTED_HAZARD_TYPES } from '../../hazard-map/hazard-map';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { SectorIconComponent } from '../../../shared/components/sector-icon/sector-icon.component';
import {
  InfoIconComponent,
  ArrowRightIconComponent,
  NoHazardsIconComponent,
} from '../../../shared/icons';
import { ShowMoreButtonComponent } from '../../../shared/components/show-more-button/show-more-button.component';
import type { AdaptationAction, Hazard, LocationProfile } from '@pac-api/client';

@Component({
  selector: 'app-hazards',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatTooltipModule,
    HazardMapComponent,
    HazardIconComponent,
    SectorIconComponent,
    InfoIconComponent,
    ArrowRightIconComponent,
    NoHazardsIconComponent,
    ShowMoreButtonComponent,
  ],
  templateUrl: './hazards.component.html',
  styleUrls: ['./hazards.component.css'],
})
export class HazardsComponent implements AfterViewInit, OnDestroy {
  @Input() data: LocationProfile | null = null;
  @Input() jurisdictionBounds?: google.maps.LatLngBounds;

  @Output() exploreActions = new EventEmitter<Hazard>();

  @ViewChildren('dataFieldContent') dataFieldContents!: QueryList<ElementRef>;
  @ViewChildren('hazardCardInner') hazardCardInners!: QueryList<ElementRef>;
  @ViewChildren('topHazardsGrid') topHazardsGrids!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('sectorList') sectorLists!: QueryList<ElementRef<HTMLElement>>;

  expandedHazards = new Set<string>();
  showAllHazards = false;
  topHazardsRevealed = false;
  private overflowMap = new Map<string, boolean>();
  private cardHeightPxMap = new Map<string, number>();
  // pb-20 (80px) reserved at the bottom of the inner data when expanded so the
  // absolutely-positioned toggle button doesn't overlap the last data row.
  private static readonly EXPANDED_PADDING_PX = 80;
  private observers: IntersectionObserver[] = [];
  private rafIds: number[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  get requesters(): string[] {
    return (this.data?.requesters ?? [])
      .flatMap((r) => r.split(',').map((s) => s.trim()))
      .filter(Boolean);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.measureCards());
    this.dataFieldContents.changes.subscribe(() => setTimeout(() => this.measureCards()));
    this.topHazardsGrids.changes.subscribe(() =>
      setTimeout(() => this.observeTopHazardsGrid()),
    );
    this.sectorLists.changes.subscribe(() => setTimeout(() => this.observeSectorList()));
    setTimeout(() => {
      this.observeTopHazardsGrid();
      this.observeSectorList();
    });
  }

  ngOnDestroy(): void {
    this.observers.forEach((o) => o.disconnect());
    this.observers = [];
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.rafIds = [];
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private observeTopHazardsGrid(): void {
    const grid = this.topHazardsGrids.first?.nativeElement;
    if (!grid || this.topHazardsRevealed) return;
    if (typeof IntersectionObserver === 'undefined' || this.prefersReducedMotion()) {
      this.topHazardsRevealed = true;
      this.cdr.markForCheck();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.zone.run(() => {
              this.topHazardsRevealed = true;
              this.cdr.markForCheck();
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(grid);
    this.observers.push(observer);
  }

  private observeSectorList(): void {
    const list = this.sectorLists.first?.nativeElement;
    if (!list) return;
    if (typeof IntersectionObserver === 'undefined' || this.prefersReducedMotion()) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.runSectorScrollHint(list);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(list);
    this.observers.push(observer);
  }

  private runSectorScrollHint(el: HTMLElement): void {
    const overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= 8) return;
    const distance = Math.min(overflow, 140);
    const duration = 1100;
    el.scrollTop = distance;
    this.zone.runOutsideAngular(() => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.scrollTop = distance * (1 - eased);
        if (t < 1) this.rafIds.push(requestAnimationFrame(step));
      };
      this.rafIds.push(requestAnimationFrame(step));
    });
  }

  private measureCards(): void {
    const hazards = this.data?.hazards?.hazards ?? [];
    const visible = this.showAllHazards ? hazards : hazards.slice(0, 4);
    const dataEls = this.dataFieldContents.toArray();
    const cardEls = this.hazardCardInners.toArray();
    visible.forEach((item, i) => {
      const innerData = dataEls[i]?.nativeElement as HTMLElement | undefined;
      const cardEl = cardEls[i]?.nativeElement as HTMLElement | undefined;
      if (!innerData || !cardEl) return;
      const key = this.getHazardKey(item.hazard as Hazard);
      const innerOverflow = Math.max(0, innerData.scrollHeight - innerData.clientHeight);
      const expanded = this.isHazardExpanded(item.hazard as Hazard);
      if (!expanded) {
        this.overflowMap.set(key, innerOverflow > 0);
      }
      const natural = expanded
        ? cardEl.scrollHeight
        : cardEl.clientHeight +
          innerOverflow +
          (innerOverflow > 0 ? HazardsComponent.EXPANDED_PADDING_PX : 0);
      if (natural > 0) this.cardHeightPxMap.set(key, natural);
    });
    this.cdr.detectChanges();
  }

  cardMaxHeightPx(hazard: Hazard): string {
    const h = this.cardHeightPxMap.get(this.getHazardKey(hazard));
    return h ? `${h}px` : '5000px';
  }

  hazardOverflows(hazard: Hazard): boolean {
    return this.overflowMap.get(this.getHazardKey(hazard)) ?? false;
  }

  hasMapData(hazard: Hazard): boolean {
    return SUPPORTED_HAZARD_TYPES.includes(hazard.hazardType);
  }

  getActionsCountForHazard(hazard: Hazard): number {
    if (!this.data?.governmentActions?.actions) return 0;

    return this.data.governmentActions.actions.filter((action: AdaptationAction) =>
      action.hazardsAddressed?.some(
        (h: Hazard) =>
          h.hazardType === hazard.hazardType &&
          (h.otherHazardDetails || '') === (hazard.otherHazardDetails || ''),
      ),
    ).length;
  }

  isHazardExpanded(hazard: Hazard): boolean {
    return this.expandedHazards.has(this.getHazardKey(hazard));
  }

  toggleHazard(hazard: Hazard): void {
    const key = this.getHazardKey(hazard);
    if (this.expandedHazards.has(key)) {
      this.expandedHazards.delete(key);
    } else {
      this.expandedHazards.add(key);
    }
  }

  private getHazardKey(hazard: Hazard): string {
    return `${hazard.hazardType}|${hazard.otherHazardDetails || ''}`;
  }

  onExploreActions(hazard: Hazard): void {
    this.exploreActions.emit(hazard);
  }

  parseImpact(text: string): { text: string; url: string | null } {
    const normalized = text.replace(/\\n/g, '\n');
    const urlRegex = /(https?:\/\/\S+)/;
    const match = normalized.match(urlRegex);
    if (!match) return { text: normalized.trim(), url: null };
    return {
      text: normalized.slice(0, match.index).trim(),
      url: match[0],
    };
  }
}
