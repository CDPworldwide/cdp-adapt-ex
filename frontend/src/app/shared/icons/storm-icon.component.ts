import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-storm-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './storm-icon.component.html',
})
export class StormIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
