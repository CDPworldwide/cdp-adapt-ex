import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-download-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './download-icon.component.html',
})
export class DownloadIconComponent {
  @Input() size: string = '14';
  @Input() color: string = '#1E1E1E';
}
