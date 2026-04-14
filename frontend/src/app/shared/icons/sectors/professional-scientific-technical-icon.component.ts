import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-professional-scientific-technical-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './professional-scientific-technical-icon.component.html',
})
export class ProfessionalScientificTechnicalIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
