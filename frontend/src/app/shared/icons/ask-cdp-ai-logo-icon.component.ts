import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ask-cdp-ai-logo-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ask-cdp-ai-logo-icon.component.html',
})
export class AskCdpAiLogoIconComponent {
  @Input() size: string = '17';
  @Input() color: string = 'currentColor';
}
