import {
  Component,
  Input,
  inject,
  DestroyRef,
  OnInit,
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
  type AskCdpAiDebugInfo,
} from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { TranslateModule } from '@ngx-translate/core';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { locationProperties } from '../../core/analytics/analytics-events';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { AskCdpAiOrganizationSelectorComponent } from './ask-cdp-ai-organization-selector.component';
import { environment } from '@env/environment';

@Component({
  selector: 'app-ask-cdp-ai',
  standalone: true,
  imports: [FormsModule, TranslateModule, AskCdpAiOrganizationSelectorComponent],
  templateUrl: './ask-cdp-ai.html',
  styleUrls: ['./ask-cdp-ai.css'],
})
export class AskCdpAiComponent implements OnInit, OnChanges {
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

  conversationHistory = this.askCdpAiService.conversationHistory;
  isDisclosureLoading = this.askCdpAiService.isDisclosureLoading;
  disclosureError = this.askCdpAiService.disclosureError;
  followUpQuestions = this.askCdpAiService.followUpQuestions;
  isFollowUpLoading = this.askCdpAiService.isFollowUpLoading;
  followUpError = this.askCdpAiService.followUpError;
  debugInfo = this.askCdpAiService.debugInfo;

  userQuery = '';
  selectedReferenceOrganizations = signal<LocationSuggestion[]>([]);
  showAllStarterQuestions = signal(false);

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

  toggleOpen() {
    this.openChange.emit(false);
  }

  get locationDisplayName(): string {
    return this.locationData?.name || '';
  }

  get displayedStarterQuestions(): string[] {
    return this.showAllStarterQuestions() ? this.followUpQuestions() : [];
  }

  get shouldShowDebugInfo(): boolean {
    return Boolean(environment.isDebugMode && this.debugInfo());
  }

  get debugRows(): Array<{ label: string; value: string }> {
    const debugInfo = this.debugInfo();
    if (!debugInfo) {
      return [];
    }

    return [
      ['Trace', debugInfo.traceId],
      ['Span', debugInfo.spanId],
      ['Prompt', this.promptLabel(debugInfo)],
      ['Context', debugInfo.contextArea],
      ['Organizations', this.formatNumberList(debugInfo.organizationIds)],
      ['Comparison orgs', this.formatNumberList(debugInfo.comparisonOrgIds)],
      ['Comparison locations', this.formatValue(debugInfo.comparisonLocationCount)],
      ['Latency', this.formatLatency(debugInfo.latencyMs)],
      ['Tokens', this.formatTokens(debugInfo)],
      ['Steps', debugInfo.stepTypes?.join(', ')],
    ]
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => ({ label: label ?? '', value: value ?? '' }));
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

  private executeChatQuery(query: string) {
    this.showAllStarterQuestions.set(false);
    const chatQuery$ = this.showSuggestions
      ? this.askCdpAiService.sendChatQuery(query)
      : this.askCdpAiService.sendChatQuery(query, false);

    chatQuery$
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

  private sanitizeAnalyticsQuery(query: string): string {
    return query
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000);
  }

  private promptLabel(debugInfo: AskCdpAiDebugInfo): string | undefined {
    if (!debugInfo.promptName) {
      return undefined;
    }
    return [debugInfo.promptName, debugInfo.promptSourceKind].filter(Boolean).join(' / ');
  }

  private formatNumberList(value: number[] | undefined): string | undefined {
    return value?.length ? value.join(', ') : undefined;
  }

  private formatLatency(value: number | undefined): string | undefined {
    return typeof value === 'number' ? `${value} ms` : undefined;
  }

  private formatTokens(debugInfo: AskCdpAiDebugInfo): string | undefined {
    if (debugInfo.totalTokens == null) {
      return undefined;
    }
    return `${debugInfo.totalTokens} total (${debugInfo.inputTokens ?? 0} in, ${
      debugInfo.outputTokens ?? 0
    } out)`;
  }

  private formatValue(value: unknown): string | undefined {
    if (value == null) {
      return undefined;
    }
    return String(value);
  }
}
