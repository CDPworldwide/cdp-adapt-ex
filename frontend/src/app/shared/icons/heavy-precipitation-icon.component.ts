import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-heavy-precipitation-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './heavy-precipitation-icon.component.html',
})
export class HeavyPrecipitationIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
