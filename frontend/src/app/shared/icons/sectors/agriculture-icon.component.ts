import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-agriculture-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agriculture-icon.component.html',
})
export class AgricultureIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
