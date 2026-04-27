import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-arrow-right-long-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arrow-right-long-icon.component.html',
})
export class ArrowRightLongIconComponent {
  @Input() color: string = 'white';
  @Input() size: string = '20';
}
