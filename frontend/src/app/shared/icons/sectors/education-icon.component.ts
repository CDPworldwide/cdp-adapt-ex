import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-education-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './education-icon.component.html',
})
export class EducationIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
