import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { AdaptationAction, ActionStatus } from '@pac-api/client';
import { CloseIconComponent } from '../../../../shared/icons/close-icon.component';
import { ImagePlaceholderIconComponent } from '../../../../shared/icons/image-placeholder-icon.component';
import { InfoIconComponent } from '../../../../shared/icons/info-icon.component';
import { HazardIconComponent } from '../../../../shared/components/hazard-icon/hazard-icon.component';
import { SectorIconComponent } from '../../../../shared/components/sector-icon/sector-icon.component';
import { AutoTranslatePipe } from '../../../../shared/pipes/auto-translate.pipe';

@Component({
  selector: 'app-adaptation-action-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    SectorIconComponent,
    CloseIconComponent,
    ImagePlaceholderIconComponent,
    InfoIconComponent,
    MatTooltipModule,
    MatIconModule,
    AutoTranslatePipe,
  ],
  templateUrl: './adaptation-action-detail.component.html',
})
export class AdaptationActionDetailComponent {
  @Input() action!: AdaptationAction;
  @Input() locationName?: string;
  @Input() countryName?: string;
  @Input() showHeroImage: boolean = true;
  @Output() closed = new EventEmitter<void>();

  expanded = false;

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
    if (s.startsWith('IMPLEMENTATION')) return 'bg-cdp-green text-cdp-dark';
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
}
