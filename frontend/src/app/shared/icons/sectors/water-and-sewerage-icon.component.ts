import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-water-and-sewerage-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './water-and-sewerage-icon.component.html',
})
export class WaterAndSewerageIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
