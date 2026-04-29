import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  CheckCircleIconComponent,
  WaterSecurityIconComponent,
  MoneyCircleIconComponent,
  EarthIconComponent,
} from '../../../shared/icons';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import type { DisclosureTrendsSummary } from './disclosure-trends.stats';

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
export class DisclosureTrendsComponent {
  @Input() summary!: DisclosureTrendsSummary;
  @Input() year!: number;

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
}
