import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-icon.component.html',
})
export class InfoIconComponent {
  @Input() size: string | number = '20';
  @Input() variant: 'outline' | 'filled' = 'outline';
}
