import {
  Component,
  Input,
  inject,
  DestroyRef,
  OnInit,
  OnChanges,
  AfterViewChecked,
  SimpleChanges,
  Output,
  EventEmitter,
  signal,
  ElementRef,
  ViewChild,
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
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { locationProperties } from '../../core/analytics/analytics-events';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { AskCdpAiOrganizationSelectorComponent } from './ask-cdp-ai-organization-selector.component';

@Component({
  selector: 'app-ask-cdp-ai',
  standalone: true,
  imports: [FormsModule, TranslateModule, AskCdpAiOrganizationSelectorComponent],
  templateUrl: './ask-cdp-ai.html',
  styleUrls: ['./ask-cdp-ai.css'],
})
export class AskCdpAiComponent implements OnInit, OnChanges, AfterViewChecked {
  private askCdpAiService = inject(AskCdpAiService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private mobileKeyboardViewportService = inject(MobileKeyboardViewportService);
  private posthog = inject(AnalyticsService);

  @Input() locationData: LocationProfile | null = null;
  @Input() contextArea: AskCdpAiContextArea = 'hazards';
  @Input() isOpen = false;
  @Input() showCloseButton = true;
  @Input() showSuggestions = true;
  @Input() showPanelHeader = true;
  @Input() showLocalTestControls = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() locationDataCleared = new EventEmitter<void>();
  @ViewChild('messageScrollerViewport')
  private messageScrollerViewport?: ElementRef<HTMLElement>;

  conversationHistory = this.askCdpAiService.conversationHistory;
  isDisclosureLoading = this.askCdpAiService.isDisclosureLoading;
  disclosureError = this.askCdpAiService.disclosureError;
  followUpQuestions = this.askCdpAiService.followUpQuestions;
  isFollowUpLoading = this.askCdpAiService.isFollowUpLoading;
  followUpError = this.askCdpAiService.followUpError;

  userQuery = '';
  selectedReferenceOrganizations = signal<LocationSuggestion[]>([]);
  showAllStarterQuestions = signal(false);
  showJumpToLatest = signal(false);

  private readonly fallbackLandingPrompts = [
    'Compare two locations',
    'Find rising hazards',
    'Summarize adaptation actions',
    'Show funding-ready projects',
  ];

  private lastRenderedMessageCount = 0;
  private shouldFollowLatest = true;

  constructor() {
    this.destroyRef.onDestroy(() => this.askCdpAiService.clearSession());
  }

  ngOnInit(): void {
    this.setChatContext();
    this.loadStarterQuestions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['locationData'] || changes['contextArea']) {
      this.setChatContext();
      this.loadStarterQuestions();
    }

    if (changes['isOpen']?.currentValue === true && changes['isOpen'].previousValue !== true) {
      this.posthog.capture('ai_chat_opened', {
        ...locationProperties(this.locationData),
        context_area: this.contextArea,
      });
    }
  }

  ngAfterViewChecked(): void {
    this.syncMessageScrollerPosition();
  }

  toggleOpen() {
    this.openChange.emit(false);
  }

  get locationDisplayName(): string {
    return this.locationData?.name || '';
  }

  get displayedStarterQuestions(): string[] {
    return this.showAllStarterQuestions() ? this.followUpQuestions() : [];
  }

  get isLandingState(): boolean {
    return (
      this.conversationHistory().length === 0 &&
      !this.isDisclosureLoading() &&
      !this.disclosureError()
    );
  }

  get landingPromptSuggestions(): string[] {
    return (
      this.followUpQuestions().length ? this.followUpQuestions() : this.fallbackLandingPrompts
    ).slice(0, 4);
  }

  landingPromptIcon(prompt: string): 'compare' | 'hazard' | 'actions' | 'funding' | 'default' {
    const normalizedPrompt = prompt.toLowerCase();

    if (normalizedPrompt.includes('compare')) {
      return 'compare';
    }

    if (normalizedPrompt.includes('hazard') || normalizedPrompt.includes('risk')) {
      return 'hazard';
    }

    if (normalizedPrompt.includes('fund')) {
      return 'funding';
    }

    if (normalizedPrompt.includes('action') || normalizedPrompt.includes('adaptation')) {
      return 'actions';
    }

    return 'default';
  }

  sendQuery() {
    if (!this.userQuery.trim()) return;
    const query = this.userQuery.trim();
    this.posthog.capture('ai_chat_query_submitted', {
      ...locationProperties(this.locationData),
      context_area: this.contextArea,
      query: this.sanitizeAnalyticsQuery(query),
      query_length: query.length,
      source: 'manual',
    });
    this.executeChatQuery(query);
    this.userQuery = '';
  }

  onMessageScrollerScroll(): void {
    const viewport = this.messageScrollerViewport?.nativeElement;
    if (!viewport) {
      return;
    }

    const distanceFromEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isAtLiveEdge = distanceFromEnd < 96;
    this.shouldFollowLatest = isAtLiveEdge;
    this.showJumpToLatest.set(!isAtLiveEdge && this.conversationHistory().length > 0);
  }

  jumpToLatest(): void {
    this.shouldFollowLatest = true;
    this.scrollToEnd('smooth');
  }

  messageId(index: number): string {
    return `ask-ai-message-${index}`;
  }

  messageSenderLabel(role: 'user' | 'assistant' | 'system'): string {
    if (role === 'user') {
      return 'You';
    }

    if (role === 'assistant') {
      return 'AI Explorer';
    }

    return 'System';
  }

  get contextAttachmentCount(): number {
    return (this.locationData ? 1 : 0) + this.selectedReferenceOrganizations().length;
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
    this.posthog.capture('ai_chat_followup_clicked', {
      ...locationProperties(this.locationData),
      context_area: this.contextArea,
      query: this.sanitizeAnalyticsQuery(question),
      query_length: question.length,
      source: 'followup',
    });
    this.executeChatQuery(question);
  }

  onLandingPromptClick(prompt: string): void {
    this.posthog.capture('ai_chat_followup_clicked', {
      ...locationProperties(this.locationData),
      context_area: this.contextArea,
      query: this.sanitizeAnalyticsQuery(prompt),
      query_length: prompt.length,
      source: 'landing_prompt',
    });
    this.executeChatQuery(prompt);
  }

  toggleStarterQuestions(): void {
    this.showAllStarterQuestions.update((isOpen) => !isOpen);
  }

  loadLocalTestChat(): void {
    this.showAllStarterQuestions.set(false);
    this.askCdpAiService.loadLocalTestChat();
  }

  onReferenceOrganizationsChange(organizations: LocationSuggestion[]): void {
    this.selectedReferenceOrganizations.set(organizations);
    this.syncReferenceOrganizations();
  }

  onCurrentOrganizationCleared(): void {
    this.locationDataCleared.emit();
  }

  private executeChatQuery(query: string) {
    this.showAllStarterQuestions.set(false);
    const chatQuery$ = this.showSuggestions
      ? this.askCdpAiService.sendChatQuery(query)
      : this.askCdpAiService.sendChatQuery(query, false);

    chatQuery$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isFollowUpLoading.set(false);
      },
      error: (error) => {
        this.isFollowUpLoading.set(false);
        // The service already handles setting the error signal
      },
    });
  }

  private setChatContext(): void {
    this.askCdpAiService.setLocationContext(this.locationData, this.contextArea);
    this.showAllStarterQuestions.set(false);
    if (this.locationData?.organizationId != null) {
      this.selectedReferenceOrganizations.update((organizations) =>
        organizations.filter(
          (organization) => organization.organizationId !== this.locationData?.organizationId,
        ),
      );
    }
    this.syncReferenceOrganizations();
  }

  private loadStarterQuestions(): void {
    if (!this.showSuggestions) {
      return;
    }

    this.askCdpAiService
      .loadStarterQuestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  private syncReferenceOrganizations(): void {
    this.askCdpAiService.setReferenceOrganizations(
      this.selectedReferenceOrganizations().map((organization) => ({
        organizationId: organization.organizationId,
        name: organization.name,
        ...(organization.country ? { country: organization.country } : {}),
      })),
    );

    if (this.showSuggestions && !this.conversationHistory().length) {
      this.loadStarterQuestions();
    }
  }

  public getSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private syncMessageScrollerPosition(): void {
    const messages = this.conversationHistory();
    const nextMessageCount = messages.length;
    if (nextMessageCount === this.lastRenderedMessageCount) {
      return;
    }

    const previousMessageCount = this.lastRenderedMessageCount;
    this.lastRenderedMessageCount = nextMessageCount;

    if (!nextMessageCount) {
      this.showJumpToLatest.set(false);
      this.shouldFollowLatest = true;
      return;
    }

    const lastMessage = messages.at(-1);
    queueMicrotask(() => {
      if (previousMessageCount === 0) {
        this.scrollToLastAnchor('auto');
        return;
      }

      if (lastMessage?.role === 'user') {
        this.scrollToMessage(nextMessageCount - 1, 'smooth');
        return;
      }

      if (this.shouldFollowLatest) {
        this.scrollToEnd('smooth');
      } else {
        this.showJumpToLatest.set(true);
      }
    });
  }

  private scrollToLastAnchor(behavior: ScrollBehavior): void {
    const messages = this.conversationHistory();
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') {
        this.scrollToMessage(index, behavior);
        return;
      }
    }

    this.scrollToEnd(behavior);
  }

  private scrollToMessage(index: number, behavior: ScrollBehavior): void {
    const viewport = this.messageScrollerViewport?.nativeElement;
    const message = viewport?.querySelector<HTMLElement>(`#${this.messageId(index)}`);
    if (!viewport || !message) {
      return;
    }

    const previousPeek = 64;
    const offset = message.offsetTop - viewport.offsetTop - previousPeek;
    viewport.scrollTo({ top: Math.max(offset, 0), behavior });
    this.showJumpToLatest.set(false);
  }

  private scrollToEnd(behavior: ScrollBehavior): void {
    const viewport = this.messageScrollerViewport?.nativeElement;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    this.showJumpToLatest.set(false);
  }

  private sanitizeAnalyticsQuery(query: string): string {
    return query
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000);
  }
}
