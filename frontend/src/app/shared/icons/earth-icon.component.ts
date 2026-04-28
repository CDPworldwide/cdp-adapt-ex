import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-earth-icon',
  standalone: true,
  templateUrl: './earth-icon.component.html',
  styleUrls: [],
})
export class EarthIconComponent {
  @Input() size = '32';
  @Input() color = 'white';
}
