import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-extreme-cold-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './extreme-cold-icon.component.html',
})
export class ExtremeColdIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
