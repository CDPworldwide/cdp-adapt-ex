import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mining-and-quarrying-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mining-and-quarrying-icon.component.html',
})
export class MiningAndQuarryingIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
