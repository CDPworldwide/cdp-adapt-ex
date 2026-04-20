import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-real-estate-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './real-estate-icon.component.html',
})
export class RealEstateIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
