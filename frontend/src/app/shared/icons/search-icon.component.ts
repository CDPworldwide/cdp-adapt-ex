import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-icon.component.html',
})
export class SearchIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
