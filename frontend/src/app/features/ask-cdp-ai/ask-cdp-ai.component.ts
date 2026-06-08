import {
  Component,
  Input,
  inject,
  DestroyRef,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type LocationProfile } from '@pac-api/client';
import {
  AskCdpAiService,
  type AskCdpAiContextArea,
} from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { TranslateModule } from '@ngx-translate/core';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';

declare let gtag: Function;

@Component({
  selector: 'app-ask-cdp-ai',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './ask-cdp-ai.html',
  styleUrls: ['./ask-cdp-ai.css'],
})
export class AskCdpAiComponent implements OnChanges {
  private askCdpAiService = inject(AskCdpAiService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private mobileKeyboardViewportService = inject(MobileKeyboardViewportService);

  @Input() locationData: LocationProfile | null = null;
  @Input() contextArea: AskCdpAiContextArea = 'hazards';
  @Input() isOpen = false;
  @Output() openChange = new EventEmitter<boolean>();

  conversationHistory = this.askCdpAiService.conversationHistory;
  isDisclosureLoading = this.askCdpAiService.isDisclosureLoading;
  disclosureError = this.askCdpAiService.disclosureError;
  followUpQuestions = this.askCdpAiService.followUpQuestions;
  isFollowUpLoading = signal(false);
  followUpError = this.askCdpAiService.followUpError;

  userQuery = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.askCdpAiService.clearSession());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['locationData'] || changes['contextArea']) {
      this.askCdpAiService.setLocationContext(this.locationData, this.contextArea);
    }
  }

  toggleOpen() {
    this.openChange.emit(false);
  }

  sendQuery() {
    if (!this.userQuery.trim()) return;
    const globalGtag = (window as any).gtag;
    if (typeof globalGtag === 'function') {
      globalGtag('event', 'chatbot_query_submit');
    }
    this.executeChatQuery(this.userQuery.trim());
    this.userQuery = '';
  }

  onInputFocus(event: FocusEvent): void {
    const input = event.target;
    if (input instanceof HTMLElement) {
      this.mobileKeyboardViewportService.keepElementVisible(input);
    }
  }

  onFollowUpClick(question: string) {
    if (this.isFollowUpLoading()) return;
    this.isFollowUpLoading.set(true);
    const globalGtag = (window as any).gtag;
    if (typeof globalGtag === 'function') {
      globalGtag('event', 'chatbot_suggest_click', { query_text: question });
    }
    this.executeChatQuery(question);
  }

  private executeChatQuery(query: string) {
    this.askCdpAiService
      .sendChatQuery(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isFollowUpLoading.set(false);
        },
        error: (error) => {
          this.isFollowUpLoading.set(false);
          // The service already handles setting the error signal
        },
      });
  }

  public getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
