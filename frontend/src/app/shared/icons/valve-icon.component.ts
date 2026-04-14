import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-valve-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './valve-icon.component.html',
})
export class ValveIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
