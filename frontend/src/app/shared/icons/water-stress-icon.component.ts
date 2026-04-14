import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-water-stress-icon',
  standalone: true,
  templateUrl: './water-stress-icon.component.html',
  styleUrls: [],
})
export class WaterStressIconComponent {
  @Input() size = '24';
  @Input() color = 'currentColor';
}
