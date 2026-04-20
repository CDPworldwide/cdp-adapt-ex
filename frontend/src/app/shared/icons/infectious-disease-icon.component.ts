import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-infectious-disease-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './infectious-disease-icon.component.html',
})
export class InfectiousDiseaseIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
