import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-water-security-icon',
  standalone: true,
  templateUrl: './water-security-icon.component.html',
  styleUrls: [],
})
export class WaterSecurityIconComponent {
  @Input() size = '32';
  @Input() color = 'none';
}
