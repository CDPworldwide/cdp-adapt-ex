import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-other-landscape-shift-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './other-landscape-shift-icon.component.html',
})
export class OtherLandscapeShiftIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
