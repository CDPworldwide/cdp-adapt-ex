import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-placeholder-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-placeholder-icon.component.html',
})
export class ImagePlaceholderIconComponent {
  @Input() size: string = '56';
  @Input() color: string = 'white';
}
