import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-soil-degradation-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './soil-degradation-icon.component.html',
})
export class SoilDegradationIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
