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
import { type LocationProfileOutput } from '@pac-api/client';
import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { TranslateModule } from '@ngx-translate/core';
import { marked } from 'marked';

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

  @Input() locationData: LocationProfileOutput | null = null;
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
    if (changes['locationData']) {
      this.askCdpAiService.setLocationContext(this.locationData);
    }

    if (changes['isOpen'] && this.isOpen && this.conversationHistory().length === 0) {
      this.askCdpAiService
        .loadStarterQuestions()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
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
