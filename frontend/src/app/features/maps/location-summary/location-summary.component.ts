import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { CloseIconComponent } from '../../../shared/icons';
import type { Hazard, LocationPin } from '@pac-api/client';
import { ReportingLeaderChipComponent } from '../../../shared/components/reporting-leader-chip/reporting-leader-chip.component';

@Component({
  selector: 'app-location-summary',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatProgressSpinnerModule,
    HazardIconComponent,
    CloseIconComponent,
    ReportingLeaderChipComponent,
  ],
  templateUrl: './location-summary.component.html',
  styleUrls: ['./location-summary.component.css'],
})
export class LocationSummaryComponent {
  @Input() location: LocationPin | null = null;
  @Input() isLoading = false;
  @Input() isReportingLeader = false;
  @Input() isNonPublic = false;
  @Input() totalHazards = 0;
  @Input() topHazards: Hazard[] = [];
  @Input() disclosedActions = 0;
  @Input() projectsSeekingFunding = 0;

  @Output() close = new EventEmitter<void>();
  @Output() learnMore = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onLearnMore(): void {
    this.learnMore.emit();
  }
}
