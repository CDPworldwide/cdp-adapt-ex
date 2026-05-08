import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { AdaptationAction, ActionStatus } from '@pac-api/client';
import { CloseIconComponent } from '../../../../shared/icons/close-icon.component';
import { InfoIconComponent } from '../../../../shared/icons/info-icon.component';
import { LocationPinIconComponent } from '../../../../shared/icons/location-pin-icon.component';
import { HazardIconComponent } from '../../../../shared/components/hazard-icon/hazard-icon.component';
import { SectorIconComponent } from '../../../../shared/components/sector-icon/sector-icon.component';
import { AutoTranslatePipe } from '../../../../shared/pipes/auto-translate.pipe';
import { splitTitleAtLastColon } from '../../../../shared/utils/title.util';

export const DETAIL_HERO_BACKGROUND = `linear-gradient(270deg, rgba(30, 30, 30, 0.20) 0%, rgba(30, 30, 30, 0.50) 54.96%), url(assets/images/solutions-detail-modal.component.images/enviornmental_bkgs_shading.webp) #1B232C center / cover no-repeat`;

@Component({
  selector: 'app-adaptation-action-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    SectorIconComponent,
    CloseIconComponent,
    InfoIconComponent,
    MatTooltipModule,
    MatIconModule,
    AutoTranslatePipe,
    LocationPinIconComponent,
  ],
  templateUrl: './adaptation-action-detail.component.html',
})
export class AdaptationActionDetailComponent {
  @Input() action!: AdaptationAction;
  @Input() locationName?: string;
  @Input() countryName?: string;
  @Input() showHeroImage: boolean = true;

  readonly heroBackground = DETAIL_HERO_BACKGROUND;
  splitTitleAtLastColon = splitTitleAtLastColon;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('descriptionElement') descriptionElement?: ElementRef<HTMLElement>;

  expanded = false;
  canExpand = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.checkTruncation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['action']) {
      this.expanded = false;
      this.canExpand = false;
      this.checkTruncation();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkTruncation();
  }

  toggleExpand(): void {
    this.expanded = !this.expanded;
  }

  close(): void {
    this.closed.emit();
  }

  getStatusBadgeClass(status: ActionStatus): string {
    if (!status) return 'bg-cdp-neutral-05 text-white';
    const s = status.statusType;
    if (s.startsWith('ACTION_IN_OPERATION')) return 'bg-cdp-blue text-white';
    if (s.startsWith('IMPLEMENTATION')) return 'bg-cdp-green-implementation text-white';
    return 'bg-cdp-neutral-05 text-white';
  }

  hasMultipleTimeframes(): boolean {
    return this.action.timeframe?.includes('|') ?? false;
  }

  getTimeframes(): Array<{ main: string; secondary: string | null }> {
    if (!this.action.timeframe) return [];
    return this.action.timeframe.split('|').map((t) => {
      const parts = t.split('(');
      const match = t.match(/\(([^)]+)\)/);
      return {
        main: parts[0].trim(),
        secondary: match ? match[1] : null,
      };
    });
  }

  getTimeframeMain(): string {
    if (!this.action.timeframe) return '—';
    const parts = this.action.timeframe.split('(');
    return parts[0].trim();
  }

  getTimeframeSecondary(): string | null {
    if (!this.action.timeframe) return null;
    const match = this.action.timeframe.match(/\(([^)]+)\)/);
    return match ? match[1] : null;
  }

  checkTruncation(): void {
    // Small timeout to allow the view to render
    setTimeout(() => {
      if (this.descriptionElement && !this.expanded) {
        const el = this.descriptionElement.nativeElement;
        // Use a 1px tolerance for subpixel rounding issues
        const isTruncated = el.scrollHeight > el.clientHeight + 1;
        if (this.canExpand !== isTruncated) {
          this.canExpand = isTruncated;
          this.cdr.detectChanges();
        }
      }
    }, 0);
  }
}
