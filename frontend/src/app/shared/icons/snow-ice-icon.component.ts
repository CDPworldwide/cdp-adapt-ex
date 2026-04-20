import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-snow-ice-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './snow-ice-icon.component.html',
})
export class SnowIceIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
