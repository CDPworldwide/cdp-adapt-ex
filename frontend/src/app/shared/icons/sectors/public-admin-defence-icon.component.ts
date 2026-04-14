import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-public-admin-defence-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-admin-defence-icon.component.html',
})
export class PublicAdminDefenceIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
