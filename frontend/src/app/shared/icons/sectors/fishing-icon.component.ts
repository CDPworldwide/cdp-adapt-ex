import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fishing-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fishing-icon.component.html',
})
export class FishingIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
