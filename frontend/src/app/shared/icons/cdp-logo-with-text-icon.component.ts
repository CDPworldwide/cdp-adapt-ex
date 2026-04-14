import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cdp-logo-with-text-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cdp-logo-with-text-icon.component.html',
})
export class CdpLogoWithTextIconComponent {
  @Input() width: string = '93';
  @Input() height: string = '24';
  @Input() color: string = 'black';
}
