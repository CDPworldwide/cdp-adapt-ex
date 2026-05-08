import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-check-circle-icon',
  standalone: true,
  templateUrl: './check-circle-icon.component.html',
  styleUrls: [],
})
export class CheckCircleIconComponent {
  @Input() size = '32';
  @Input() color = 'white';
}
