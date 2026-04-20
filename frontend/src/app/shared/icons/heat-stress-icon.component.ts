import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-heat-stress-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './heat-stress-icon.component.html',
})
export class HeatStressIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
