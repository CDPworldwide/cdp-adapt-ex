import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { InfoIconComponent } from '../../icons';
import { LinkedInfoTooltipComponent } from '../linked-info-tooltip/linked-info-tooltip.component';

@Component({
  selector: 'app-reporting-leader-chip',
  standalone: true,
  imports: [TranslateModule, InfoIconComponent, LinkedInfoTooltipComponent],
  templateUrl: './reporting-leader-chip.component.html',
  styles: [':host { display: inline-flex; align-items: center; position: relative; vertical-align: middle; }'],
})
export class ReportingLeaderChipComponent {}
