import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drought-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './drought-icon.component.html',
})
export class DroughtIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
