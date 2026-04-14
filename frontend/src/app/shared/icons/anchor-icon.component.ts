import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-anchor-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anchor-icon.component.html',
})
export class AnchorIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'white';
}
