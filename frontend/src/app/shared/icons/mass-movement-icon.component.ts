import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mass-movement-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mass-movement-icon.component.html',
})
export class MassMovementIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
