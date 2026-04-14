import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-river-flooding-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './river-flooding-icon.component.html',
})
export class RiverFloodingIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
