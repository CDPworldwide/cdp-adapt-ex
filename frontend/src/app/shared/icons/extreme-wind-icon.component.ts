import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-extreme-wind-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './extreme-wind-icon.component.html',
})
export class ExtremeWindIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
