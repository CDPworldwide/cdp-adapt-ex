import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AdaptationGoal } from '@pac-api/client';
import { CloseIconComponent } from '../../../../shared/icons/close-icon.component';
import { ImagePlaceholderIconComponent } from '../../../../shared/icons/image-placeholder-icon.component';
import { HazardIconComponent } from '../../../../shared/components/hazard-icon/hazard-icon.component';
import { AutoTranslatePipe } from '../../../../shared/pipes/auto-translate.pipe';

@Component({
  selector: 'app-adaptation-goal-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    CloseIconComponent,
    ImagePlaceholderIconComponent,
    AutoTranslatePipe,
  ],
  templateUrl: './adaptation-goal-detail.component.html',
})
export class AdaptationGoalDetailComponent {
  @Input() goal!: AdaptationGoal;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }
}
