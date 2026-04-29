import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import {
  chatCompletionsApiV1ChatsCompletionsPost,
  suggestFollowUpsApiV1SuggestFollowUpsPost,
  type LocationProfileInput,
  type OpenAiChatCompletionRequest,
  type OpenAiChatCompletionResponse,
} from '@pac-api/client';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TranslateService } from '@ngx-translate/core';
import { createApiClient } from '../../shared/services/api-client';

@Injectable({
  providedIn: 'root',
})
export class AskCdpAiService {
  private translateService = inject(TranslateService);
  private client = createApiClient();

  readonly disclosure = signal<string | null>(null);
  readonly followUpQuestions = signal<string[]>([]);
  readonly isDisclosureLoading = signal<boolean>(false);
  readonly disclosureError = signal<string | null>(null);
  readonly isFollowUpLoading = signal<boolean>(false);
  readonly followUpError = signal<string | null>(null);
  readonly conversationHistory = signal<
    Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  >([]);

  private locationContext: LocationProfileInput | null = null;
  private locationContextKey: string | null = null;

  setLocationContext(locationData: LocationProfileInput | null | undefined): void {
    const nextLocationContext = locationData ?? null;
    const nextLocationContextKey = this.buildLocationContextKey(nextLocationContext);

    if (nextLocationContextKey === this.locationContextKey) {
      this.locationContext = nextLocationContext;
      return;
    }

    this.locationContext = nextLocationContext;
    this.locationContextKey = nextLocationContextKey;
    this.resetConversationState();
  }

  clearSession(): void {
    this.locationContext = null;
    this.locationContextKey = null;
    this.resetConversationState();
  }

  loadStarterQuestions(): Observable<void> {
    if (
      this.disclosure() ||
      this.isDisclosureLoading() ||
      this.isFollowUpLoading() ||
      this.followUpQuestions().length
    ) {
      return of(void 0);
    }

    this.followUpError.set(null);
    this.followUpQuestions.set(this.buildStarterQuestions());
    this.isFollowUpLoading.set(false);

    return of(void 0);
  }

  getFollowUpQuestions(): Observable<void> {
    this.isFollowUpLoading.set(true);
    this.followUpError.set(null);

    return from(
      suggestFollowUpsApiV1SuggestFollowUpsPost({
        client: this.client,
        body: this.buildChatRequest(),
      }),
    ).pipe(
      map((response) => {
        if (response.error) {
          throw response.error;
        }
        return response.data?.follow_up_questions || [];
      }),
      tap((questions) => {
        this.followUpQuestions.set(questions);
        this.isFollowUpLoading.set(false);
      }),
      map(() => void 0),
      catchError((error) => {
        console.error('Error fetching follow-up questions:', error);
        this.isFollowUpLoading.set(false);
        this.followUpError.set(
          error.message || 'An error occurred while fetching the follow-up questions.',
        );
        return of(void 0);
      }),
    );
  }

  sendChatQuery(query: string): Observable<string> {
    this.isDisclosureLoading.set(true);
    this.disclosureError.set(null);
    this.followUpQuestions.set([]);
    this.followUpError.set(null);
    this.isFollowUpLoading.set(false);

    this.conversationHistory.update((history) => [...history, { role: 'user', content: query }]);

    return from(
      chatCompletionsApiV1ChatsCompletionsPost({
        client: this.client,
        body: this.buildChatRequest(),
      }),
    ).pipe(
      map((response) => {
        if (response.error) {
          throw response.error;
        }
        return response.data;
      }),
      tap((data: OpenAiChatCompletionResponse) => {
        const content = data.choices?.[0]?.message?.content || 'No disclosure available.';
        const htmlContent = this.parseToHtml(content);
        this.conversationHistory.update((history) => [
          ...history,
          { role: 'assistant', content: htmlContent },
        ]);
        this.disclosure.set(htmlContent);
        this.isDisclosureLoading.set(false);
      }),
      switchMap(() => this.getFollowUpQuestions()),
      map(() => {
        const history = this.conversationHistory();
        const lastMessage = history[history.length - 1];
        return lastMessage.content;
      }),
      catchError((error) => {
        console.error('Error fetching chat completion:', error);
        this.isDisclosureLoading.set(false);
        this.disclosureError.set(
          error.message || 'An error occurred while fetching the chat completion.',
        );
        throw error;
      }),
    );
  }

  private buildChatRequest(): OpenAiChatCompletionRequest {
    return {
      messages: this.conversationHistory() as OpenAiChatCompletionRequest['messages'],
      locationData: this.locationContext,
    };
  }

  private buildLocationContextKey(locationData: LocationProfileInput | null): string | null {
    if (!locationData) {
      return null;
    }

    return `${locationData.name}|${locationData.countryName}|${locationData.lat}|${locationData.lng}`;
  }

  private buildStarterQuestions(): string[] {
    const locationName =
      this.locationContext?.name ?? this.translateService.instant('askCdpAi.locationFallback');
    const primaryHazard = this.getPrimaryHazardLabel();
    const templates = [
      this.translateService.instant('askCdpAi.starterQuestions.primaryHazards', {
        location: locationName,
      }),
      this.translateService.instant('askCdpAi.starterQuestions.governmentActions', {
        location: locationName,
      }),
      this.translateService.instant('askCdpAi.starterQuestions.solutions', {
        location: locationName,
      }),
      this.translateService.instant('askCdpAi.starterQuestions.funding', {
        location: locationName,
      }),
    ];

    if (primaryHazard) {
      templates.push(
        this.translateService.instant('askCdpAi.starterQuestions.primaryHazardDetails', {
          location: locationName,
          hazard: primaryHazard,
        }),
      );
    }

    return this.shuffle(templates).slice(0, 3);
  }

  private getPrimaryHazardLabel(): string | null {
    const primaryHazard = this.locationContext?.hazards?.hazards?.[0];

    if (!primaryHazard?.hazard) {
      return null;
    }

    const { hazardType, otherHazardDetails } = primaryHazard.hazard;

    if (hazardType === 'OTHERS' && otherHazardDetails) {
      return otherHazardDetails;
    }

    const translatedHazard = this.translateService.instant(
      `locationCard.hazardNames.${hazardType}`,
    );

    return translatedHazard === `locationCard.hazardNames.${hazardType}` ? null : translatedHazard;
  }

  private shuffle(values: string[]): string[] {
    const shuffled = [...values];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
  }

  private resetConversationState(): void {
    this.conversationHistory.set([]);
    this.disclosure.set(null);
    this.disclosureError.set(null);
    this.isDisclosureLoading.set(false);
    this.followUpQuestions.set([]);
    this.followUpError.set(null);
    this.isFollowUpLoading.set(false);
  }

  public parseToHtml(content: string): string {
    const dirty = marked(content) as string;
    return DOMPurify.sanitize(dirty);
  }
}
