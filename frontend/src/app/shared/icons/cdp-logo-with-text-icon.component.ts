import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

const LOGO_ASPECT_RATIO = 10153.46 / 836.89;

@Component({
  selector: 'app-cdp-logo-with-text-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cdp-logo-with-text-icon.component.html',
})
export class CdpLogoWithTextIconComponent {
  @Input() height: string = '16';
  @Input() color: string = 'black';

  get width(): string {
    return (Number(this.height) * LOGO_ASPECT_RATIO).toFixed(1);
  }
}
