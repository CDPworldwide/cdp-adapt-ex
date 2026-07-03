import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import { AskCdpAiLogoIconComponent } from '../../shared/icons/ask-cdp-ai-logo-icon.component';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { AskCdpAiComponent } from '../ask-cdp-ai/ask-cdp-ai.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [AppHeaderComponent, AskCdpAiComponent, AskCdpAiLogoIconComponent, TranslateModule],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.css',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ChatPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly mobileKeyboardViewportService = inject(MobileKeyboardViewportService);

  ngOnInit(): void {
    this.mobileKeyboardViewportService.startTracking(this.destroyRef);
  }
}
