import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-close-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './close-icon.component.html',
})
export class CloseIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'black';
}
