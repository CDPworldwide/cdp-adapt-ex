import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-arrow-left-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arrow-left-icon.component.html',
})
export class ArrowLeftIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'white';
  @Input() strokeWidth: string = '2';
}
