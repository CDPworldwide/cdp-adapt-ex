import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-money-circle-icon',
  standalone: true,
  templateUrl: './money-circle-icon.component.html',
  styleUrls: [],
})
export class MoneyCircleIconComponent {
  @Input() size = '32';
  @Input() color = 'white';
}
