import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tractor-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tractor-icon.component.html',
})
export class TractorIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'white';
}
