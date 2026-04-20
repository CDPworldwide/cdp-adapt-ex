import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-biodiversity-loss-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './biodiversity-loss-icon.component.html',
})
export class BiodiversityLossIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
