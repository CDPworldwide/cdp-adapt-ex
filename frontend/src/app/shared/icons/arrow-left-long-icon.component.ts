import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-arrow-left-long-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arrow-left-long-icon.component.html',
})
export class ArrowLeftLongIconComponent {
  @Input() color: string = 'white';
  @Input() size: string = '20';
}
