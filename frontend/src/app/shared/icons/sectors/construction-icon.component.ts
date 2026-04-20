import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-construction-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './construction-icon.component.html',
})
export class ConstructionIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
