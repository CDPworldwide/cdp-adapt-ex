import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loss-of-green-space-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loss-of-green-space-icon.component.html',
})
export class LossOfGreenSpaceIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
