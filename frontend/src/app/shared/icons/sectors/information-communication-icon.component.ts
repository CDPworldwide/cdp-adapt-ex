import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-information-communication-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './information-communication-icon.component.html',
})
export class InformationCommunicationIconComponent {
  @Input() size: string = '24';
  @Input() color: string = 'currentColor';
}
