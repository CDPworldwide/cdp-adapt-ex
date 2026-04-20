import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-arts-entertainment-recreation-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arts-entertainment-recreation-icon.component.html',
})
export class ArtsEntertainmentRecreationIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
