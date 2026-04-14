import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-human-health-social-work-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './human-health-social-work-icon.component.html',
})
export class HumanHealthSocialWorkIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
