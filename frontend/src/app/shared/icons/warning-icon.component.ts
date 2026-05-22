import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-warning-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './warning-icon.component.html',
})
export class WarningIconComponent {
  @Input() size: string = '16';
  @Input() color: string = 'currentColor';
}
