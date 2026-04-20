import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-other-sectors-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './other-sectors-icon.component.html',
})
export class OtherSectorsIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
