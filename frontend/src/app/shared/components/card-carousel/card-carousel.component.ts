import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Wraps a horizontally-scrolling row of cards (projected via <ng-content>) and
 * overlays desktop-only previous/next arrows for users who can't scroll by
 * trackpad/wheel. Arrows only appear when the row actually overflows and each
 * arrow disables once it reaches that end. On mobile the arrows are hidden and
 * native touch scrolling is used instead.
 */
@Component({
  selector: 'app-card-carousel',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  templateUrl: './card-carousel.component.html',
  styleUrl: './card-carousel.component.css',
})
export class CardCarouselComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scroller') scroller!: ElementRef<HTMLDivElement>;

  isOverflowing = false;
  canScrollLeft = false;
  canScrollRight = false;

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    const el = this.scroller.nativeElement;
    // ResizeObserver catches viewport/container resizes; MutationObserver
    // catches the card list changing (e.g. hazard filter) which alters
    // scrollWidth without changing the scroller's own box size.
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
      this.resizeObserver.observe(el);
      this.mutationObserver = new MutationObserver(() => this.scheduleUpdate());
      this.mutationObserver.observe(el, { childList: true });
    });
    // Defer the first measurement out of the current CD pass to avoid
    // ExpressionChangedAfterItHasBeenChecked.
    setTimeout(() => this.updateScrollState(), 0);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }

  onScroll(): void {
    this.updateScrollState();
  }

  scrollByPage(direction: -1 | 1): void {
    const el = this.scroller.nativeElement;
    const stride = this.cardStride(el);
    // Advance a whole number of cards (~60% of the visible width) and snap the
    // landing position to a card boundary so a click never stops mid-card.
    const cards = Math.max(1, Math.round((el.clientWidth * 0.6) / stride));
    const target = Math.round((el.scrollLeft + direction * cards * stride) / stride) * stride;
    el.scrollTo({ left: target, behavior: 'smooth' });
  }

  /** Width of one card including the inter-card gap, in px. */
  private cardStride(el: HTMLElement): number {
    const cards = el.children;
    if (cards.length >= 2) {
      return (cards[1] as HTMLElement).offsetLeft - (cards[0] as HTMLElement).offsetLeft;
    }
    if (cards.length === 1) {
      return (cards[0] as HTMLElement).offsetWidth + 16; // + gap-4 (16px)
    }
    return el.clientWidth;
  }

  private scheduleUpdate(): void {
    // Observers fire outside Angular; re-enter so the bindings update.
    this.zone.run(() => this.updateScrollState());
  }

  private updateScrollState(): void {
    const el = this.scroller?.nativeElement;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    this.isOverflowing = maxScroll > 1;
    this.canScrollLeft = el.scrollLeft > 1;
    this.canScrollRight = el.scrollLeft < maxScroll - 1;
    this.cdr.markForCheck();
  }
}
