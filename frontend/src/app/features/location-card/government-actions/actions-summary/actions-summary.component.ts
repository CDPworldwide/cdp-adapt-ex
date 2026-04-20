import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { HazardIconComponent } from '../../../../shared/components/hazard-icon/hazard-icon.component';
import type { HazardSummaryRow } from '../government-actions.types';

@Component({
  selector: 'app-actions-summary',
  standalone: true,
  imports: [CommonModule, TranslateModule, HazardIconComponent],
  templateUrl: './actions-summary.component.html',
})
export class ActionsSummaryComponent {
  @Input() summaryRows: HazardSummaryRow[] = [];
  @Input() totalGoals: number = 0;
  @Input() totalActions: number = 0;
  @Input() selectedFilter: string | null = null;

  @Output() filterChanged = new EventEmitter<string | null>();

  selectFilter(hazardKey: string | null): void {
    this.filterChanged.emit(hazardKey);
  }

  isSelected(hazardKey: string | null): boolean {
    return this.selectedFilter === hazardKey;
  }

  hazardKey(row: HazardSummaryRow): string {
    return row.hazard.hazardType + '|' + (row.hazard.otherHazardDetails || '');
  }

  trackRow(_index: number, row: HazardSummaryRow): string {
    return row.hazard.hazardType + '-' + (row.hazard.otherHazardDetails || '');
  }

  hazardName(row: HazardSummaryRow): string {
    return row.hazard.hazardType === 'OTHERS' ? row.hazard.otherHazardDetails ?? '' : '';
  }

  hazardTranslationKey(row: HazardSummaryRow): string {
    return 'locationCard.hazardNames.' + row.hazard.hazardType;
  }
}
