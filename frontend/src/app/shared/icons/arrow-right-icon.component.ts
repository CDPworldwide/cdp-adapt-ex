import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-arrow-right-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arrow-right-icon.component.html',
})
export class ArrowRightIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'white';
  @Input() strokeWidth: string = '2';
}
