import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-waste-management-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './waste-management-icon.component.html',
})
export class WasteManagementIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
