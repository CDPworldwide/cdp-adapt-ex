import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-conservation-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conservation-icon.component.html',
})
export class ConservationIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
