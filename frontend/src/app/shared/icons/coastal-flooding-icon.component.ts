import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-coastal-flooding-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coastal-flooding-icon.component.html',
})
export class CoastalFloodingIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
