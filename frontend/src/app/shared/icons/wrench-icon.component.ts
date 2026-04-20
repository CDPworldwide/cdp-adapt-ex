import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-wrench-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wrench-icon.component.html',
})
export class WrenchIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'white';
}
