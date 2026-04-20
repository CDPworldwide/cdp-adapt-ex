import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-extreme-heat-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './extreme-heat-icon.component.html',
})
export class ExtremeHeatIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
