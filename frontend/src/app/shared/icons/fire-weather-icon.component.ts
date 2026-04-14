import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fire-weather-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fire-weather-icon.component.html',
})
export class FireWeatherIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
