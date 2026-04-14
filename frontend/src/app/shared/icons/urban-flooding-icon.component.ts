import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-urban-flooding-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './urban-flooding-icon.component.html',
})
export class UrbanFloodingIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
