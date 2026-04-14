import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-other-hazard-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './other-hazard-icon.component.html',
})
export class OtherHazardIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
