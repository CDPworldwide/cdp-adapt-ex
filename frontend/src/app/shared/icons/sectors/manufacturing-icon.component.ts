import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-manufacturing-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manufacturing-icon.component.html',
})
export class ManufacturingIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
