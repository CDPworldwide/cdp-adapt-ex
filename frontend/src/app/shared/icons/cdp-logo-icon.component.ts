import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cdp-logo-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cdp-logo-icon.component.html',
})
export class CdpLogoIconComponent {
  @Input() size: string = '16';
}
