import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-forestry-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forestry-icon.component.html',
})
export class ForestryIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
