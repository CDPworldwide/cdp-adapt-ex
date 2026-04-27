import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ArrowLeftLongIconComponent, ArrowRightLongIconComponent } from '../../../shared/icons';
import {
  CheckCircleIconComponent,
  WaterSecurityIconComponent,
  MoneyCircleIconComponent,
  EarthIconComponent,
} from '../../../shared/icons';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import type { LocationProfile } from '@pac-api/client';
import {
  adaptationPlanCount as computeAdaptationPlanCount,
  waterSecurityRisksCount as computeWaterSecurityRisksCount,
  topHazards as computeTopHazards,
  projectsSeekingFinance as computeProjectsSeekingFinance,
  populationExposedPct as computePopulationExposedPct,
  type TopHazard,
  type ProjectsFinanceSummary,
} from './disclosure-trends.stats';

@Component({
  selector: 'app-disclosure-trends',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslateModule,
    ArrowLeftLongIconComponent,
    ArrowRightLongIconComponent,
    CheckCircleIconComponent,
    WaterSecurityIconComponent,
    MoneyCircleIconComponent,
    EarthIconComponent,
    HazardIconComponent,
  ],
  templateUrl: './disclosure-trends.component.html',
})
export class DisclosureTrendsComponent {
  @Input() data!: LocationProfile;
  @Input() year!: number;

  get adaptationPlanCount(): number {
    return computeAdaptationPlanCount(this.data);
  }

  get waterSecurityRisksCount(): number {
    return computeWaterSecurityRisksCount(this.data);
  }

  get topHazards(): TopHazard[] {
    return computeTopHazards(this.data);
  }

  get projectsSeekingFinance(): ProjectsFinanceSummary {
    return computeProjectsSeekingFinance(this.data);
  }

  get populationExposedPct(): number | null {
    return computePopulationExposedPct(this.data);
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
}
