import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AdaptationGoal } from '@pac-api/client';
import { CloseIconComponent } from '../../../../shared/icons/close-icon.component';
import { HazardIconComponent } from '../../../../shared/components/hazard-icon/hazard-icon.component';
import { AutoTranslatePipe } from '../../../../shared/pipes/auto-translate.pipe';
import { DETAIL_HERO_BACKGROUND } from '../adaptation-action-detail/adaptation-action-detail.component';

@Component({
  selector: 'app-adaptation-goal-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    CloseIconComponent,
    AutoTranslatePipe,
  ],
  templateUrl: './adaptation-goal-detail.component.html',
})
export class AdaptationGoalDetailComponent {
  @Input() goal!: AdaptationGoal;
  @Output() closed = new EventEmitter<void>();

  readonly heroBackground = DETAIL_HERO_BACKGROUND;

  close(): void {
    this.closed.emit();
  }
}
