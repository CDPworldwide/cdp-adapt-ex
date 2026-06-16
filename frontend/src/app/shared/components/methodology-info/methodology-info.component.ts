import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { InfoIconComponent } from '../../icons';
import { LinkedInfoTooltipComponent } from '../linked-info-tooltip/linked-info-tooltip.component';

// Info icon that reveals a small tooltip containing a link to the Methodology
// page — shown on hover (desktop) or tap (mobile). Unlike a plain link, a
// mobile tap opens the tooltip instead of navigating straight to Methodology.
@Component({
  selector: 'app-methodology-info',
  standalone: true,
  imports: [TranslateModule, InfoIconComponent, LinkedInfoTooltipComponent],
  templateUrl: './methodology-info.component.html',
  styles: [':host { display: inline-flex; position: relative; vertical-align: middle; }'],
})
export class MethodologyInfoComponent {}
