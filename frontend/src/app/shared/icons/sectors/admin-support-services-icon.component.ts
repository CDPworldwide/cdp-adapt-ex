import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-support-services-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-support-services-icon.component.html',
})
export class AdminSupportServicesIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
