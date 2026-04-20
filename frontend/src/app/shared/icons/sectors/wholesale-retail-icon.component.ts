import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-wholesale-retail-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wholesale-retail-icon.component.html',
})
export class WholesaleRetailIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
