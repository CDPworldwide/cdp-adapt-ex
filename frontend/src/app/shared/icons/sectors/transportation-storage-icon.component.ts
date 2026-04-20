import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-transportation-storage-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transportation-storage-icon.component.html',
})
export class TransportationStorageIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
