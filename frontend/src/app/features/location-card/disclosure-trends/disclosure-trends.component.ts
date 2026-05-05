import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  CheckCircleIconComponent,
  WaterSecurityIconComponent,
  MoneyCircleIconComponent,
  EarthIconComponent,
} from '../../../shared/icons';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import type { DisclosureTrendsSummary } from './disclosure-trends.stats';

const COUNTER_DURATION_MS = 1200;
const HAZARD_STAGGER_MS = 150;

@Component({
  selector: 'app-disclosure-trends',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslateModule,
    CheckCircleIconComponent,
    WaterSecurityIconComponent,
    MoneyCircleIconComponent,
    EarthIconComponent,
    HazardIconComponent,
  ],
  templateUrl: './disclosure-trends.component.html',
})
export class DisclosureTrendsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() summary!: DisclosureTrendsSummary;
  @Input() year!: number;

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  private observer?: IntersectionObserver;
  private rafIds: number[] = [];
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];

  readonly hasEntered = signal(false);
  readonly adaptationPlanDisplay = signal(0);
  readonly waterSecurityDisplay = signal(0);
  readonly projectsSeekingFinanceDisplay = signal(0);
  readonly jurisdictionsExposedPctDisplay = signal(0);
  readonly hazardNumberDisplays: WritableSignal<number>[] = [signal(0), signal(0), signal(0)];

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.snapToFinal();
      return;
    }

    if (this.prefersReducedMotion()) {
      this.hasEntered.set(true);
      this.snapToFinal();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      this.hasEntered.set(true);
      this.startCounters();
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.ngZone.run(() => {
                this.hasEntered.set(true);
                this.startCounters();
              });
              this.observer?.disconnect();
              this.observer = undefined;
              break;
            }
          }
        },
        { threshold: 0.2 },
      );
      this.observer.observe(this.elementRef.nativeElement);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] && !changes['summary'].firstChange && this.hasEntered()) {
      this.startCounters();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.cancelPending();
  }

  formatHazardType(type: string): string {
    return type
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  getHazardNumber(range: string | null): string {
    if (!range) return '';
    return range.replace('%', '').trim();
  }

  private snapToFinal(): void {
    this.adaptationPlanDisplay.set(this.summary.adaptationPlanCount);
    this.waterSecurityDisplay.set(this.summary.waterSecurityRisksCount);
    this.projectsSeekingFinanceDisplay.set(this.summary.projectsSeekingFinanceCount);
    this.jurisdictionsExposedPctDisplay.set(this.summary.jurisdictionsExposedPct ?? 0);
    this.summary.topHazards.forEach((h, i) => {
      const target = this.parseHazardNumber(h.range);
      this.hazardNumberDisplays[i]?.set(target);
    });
  }

  private startCounters(): void {
    this.cancelPending();
    this.tween(this.adaptationPlanDisplay, this.summary.adaptationPlanCount, COUNTER_DURATION_MS);
    this.tween(this.waterSecurityDisplay, this.summary.waterSecurityRisksCount, COUNTER_DURATION_MS);
    this.tween(
      this.projectsSeekingFinanceDisplay,
      this.summary.projectsSeekingFinanceCount,
      COUNTER_DURATION_MS,
    );
    this.tween(
      this.jurisdictionsExposedPctDisplay,
      this.summary.jurisdictionsExposedPct ?? 0,
      COUNTER_DURATION_MS,
    );

    this.summary.topHazards.forEach((h, i) => {
      const sig = this.hazardNumberDisplays[i];
      if (!sig) return;
      const target = this.parseHazardNumber(h.range);
      const id = setTimeout(() => this.tween(sig, target, 800), 250 + i * HAZARD_STAGGER_MS);
      this.timeoutIds.push(id);
    });
  }

  private tween(sig: WritableSignal<number>, target: number, duration: number): void {
    sig.set(0);
    if (target === 0) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      sig.set(target * eased);
      if (t < 1) {
        this.rafIds.push(requestAnimationFrame(step));
      } else {
        sig.set(target);
      }
    };
    this.rafIds.push(requestAnimationFrame(step));
  }

  private cancelPending(): void {
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.rafIds = [];
    this.timeoutIds.forEach((id) => clearTimeout(id));
    this.timeoutIds = [];
  }

  private parseHazardNumber(range: string | null | undefined): number {
    if (!range) return 0;
    const raw = this.getHazardNumber(range);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
