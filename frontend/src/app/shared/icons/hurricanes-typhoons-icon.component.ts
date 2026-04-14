import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hurricanes-typhoons-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hurricanes-typhoons-icon.component.html',
})
export class HurricanesTyphoonIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
