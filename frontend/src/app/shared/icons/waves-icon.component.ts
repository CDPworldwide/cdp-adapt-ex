import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-waves-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waves-icon.component.html',
})
export class WavesIconComponent {
  @Input() size: string = '24';

  @Input() color: string = 'currentColor';
}
