import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-no-hazards-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './no-hazards-icon.component.html',
})
export class NoHazardsIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
