import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NoHazardsIconComponent } from '../../../shared/icons';
import { EdgeCaseBannerVariant } from './edge-case-banner.util';

// Disclosure edge-case banner shown atop the Hazards and Government Actions tabs.
@Component({
  selector: 'app-edge-case-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule, NoHazardsIconComponent],
  templateUrl: './edge-case-banner.component.html',
})
export class EdgeCaseBannerComponent {
  @Input() variant: EdgeCaseBannerVariant = null;
}
