import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-accommodation-food-service-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accommodation-food-service-icon.component.html',
})
export class AccommodationFoodServiceIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
