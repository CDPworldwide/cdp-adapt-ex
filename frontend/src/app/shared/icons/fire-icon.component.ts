import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fire-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fire-icon.component.html',
})
export class FireIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'black';
}
