import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import {
  type AdaptationAction,
  type AdaptationGoal,
  type Hazard,
  type LocationProfile,
} from '@pac-api/client';
import { Chat } from '@ai-sdk/angular';
import { type ChatTransport, type UIMessage, type UIMessageChunk } from 'ai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '@env/environment';
import { buildOrganizationSlugSegment } from '../../shared/utils/org-slug.util';

type ConversationMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type OpenAiMessage = { role: 'user' | 'assistant'; content: string };
type ResponsesInputMessage = { role: 'user' | 'assistant'; content: string };
type SuggestFollowUpsResponse = { follow_up_questions?: string[] };
export type AskCdpAiContextArea = 'hazards' | 'actions' | 'solutions';
type SourceLocation = { orgId: number; name: string; countryName?: string | null };
type AiRequestBody = {
  model: string;
  stream: boolean;
  messages: OpenAiMessage[];
  metadata: {
    locationData: LocationProfile | null;
    contextArea: AskCdpAiContextArea;
  };
  locationData: LocationProfile | null;
  contextArea: AskCdpAiContextArea;
};
type AiResponsesRequestBody = {
  model: string;
  stream: boolean;
  input: string | ResponsesInputMessage[];
  max_tokens: number;
  orgId: number | null;
  metadata: {
    orgId: number | null;
    contextArea: AskCdpAiContextArea;
  };
  contextArea: AskCdpAiContextArea;
};

@Injectable({
  providedIn: 'root',
})
export class AskCdpAiService {
  private translateService = inject(TranslateService);

  readonly disclosure = signal<string | null>(null);
  readonly followUpQuestions = signal<string[]>([]);
  readonly isDisclosureLoading = signal<boolean>(false);
  readonly disclosureError = signal<string | null>(null);
  readonly isFollowUpLoading = signal<boolean>(false);
  readonly followUpError = signal<string | null>(null);
  readonly conversationHistory = signal<ConversationMessage[]>([]);

  private locationContext: LocationProfile | null = null;
  private contextArea: AskCdpAiContextArea = 'hazards';
  private selectedActionHazardFilter: string | null = null;
  private locationContextKey: string | null = null;
  private latestResponseSourceLocations: SourceLocation[] = [];
  private readonly aiChat = this.createAiChat();

  setLocationContext(
    locationData: LocationProfile | null | undefined,
    contextArea: AskCdpAiContextArea = 'hazards',
    selectedActionHazardFilter: string | null = null,
  ): void {
    const nextLocationContext = locationData ?? null;
    const nextLocationContextKey = this.buildLocationContextKey(
      nextLocationContext,
      contextArea,
      selectedActionHazardFilter,
    );

    if (nextLocationContextKey === this.locationContextKey) {
      this.locationContext = nextLocationContext;
      this.contextArea = contextArea;
      this.selectedActionHazardFilter = selectedActionHazardFilter;
      return;
    }

    this.locationContext = nextLocationContext;
    this.contextArea = contextArea;
    this.selectedActionHazardFilter = selectedActionHazardFilter;
    this.locationContextKey = nextLocationContextKey;
    this.resetConversationState();
  }

  clearSession(): void {
    this.locationContext = null;
    this.contextArea = 'hazards';
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
    return this.getFollowUpQuestions();
  }

  getFollowUpQuestions(): Observable<void> {
    this.isFollowUpLoading.set(true);
    this.followUpError.set(null);

    return from(this.fetchFollowUpQuestions()).pipe(
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

    return from(this.sendAiSdkMessage(query)).pipe(
      tap((content) => {
        this.disclosure.set(content);
        this.isDisclosureLoading.set(false);
      }),
      switchMap((content) => {
        return this.getFollowUpQuestions().pipe(map(() => content));
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

  private async sendAiSdkMessage(query: string): Promise<string> {
    this.aiChat.clearError();
    this.latestResponseSourceLocations = this.currentSourceLocations();
    await this.aiChat.sendMessage({ text: query });

    if (this.aiChat.error) {
      throw this.aiChat.error;
    }

    const content = this.getLastAssistantText(this.aiChat.messages) || 'No disclosure available.';
    const htmlContent = this.parseToHtml(content);
    this.conversationHistory.update((history) => [
      ...history,
      { role: 'assistant', content: htmlContent },
    ]);
    return htmlContent;
  }

  private createAiChat(): Chat {
    return new Chat({
      transport: this.createOpenAiChatTransport(),
    });
  }

  private createOpenAiChatTransport(): ChatTransport<UIMessage> {
    return {
      sendMessages: async ({ messages, abortSignal }) => {
        const response = await fetch(this.buildAiChatUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.buildAiHeaders(),
          },
          body: JSON.stringify(
            this.buildAiResponsesRequestBody(true, this.toResponsesInput(messages)),
          ),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error((await response.text()) || 'Failed to fetch the AI chat response.');
        }

        if (!response.body) {
          throw new Error('The response body is empty.');
        }

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          this.captureResponseSourceLocations(data);
          return this.textToUiMessageStream(this.extractAiResponseText(data));
        }

        return this.aiEventStreamToUiMessageStream(response.body);
      },
      reconnectToStream: async () => null,
    };
  }

  private buildAiChatUrl(): string {
    return `${this.buildAiServerBaseUrl()}/v1/responses`;
  }

  private buildAiHeaders(): Record<string, string> {
    const apiKey =
      'aiServerApiKey' in environment && environment.aiServerApiKey
        ? environment.aiServerApiKey
        : 'apiKey' in environment
          ? environment.apiKey
          : '';
    if (!apiKey) {
      return {};
    }

    const apiKeyHeaderName =
      'aiServerApiKeyHeaderName' in environment && environment.aiServerApiKeyHeaderName
        ? environment.aiServerApiKeyHeaderName
        : 'apiKeyHeaderName' in environment
          ? environment.apiKeyHeaderName
          : 'X-API-Key';

    return {
      Authorization: `Bearer ${apiKey}`,
      [apiKeyHeaderName]: apiKey,
    };
  }

  private toOpenAiMessages(messages: UIMessage[]): OpenAiMessage[] {
    return messages.reduce<OpenAiMessage[]>((openAiMessages, message) => {
      if (message.role === 'user' || message.role === 'assistant') {
        openAiMessages.push({
          role: message.role,
          content: this.getMessageText(message),
        });
      }

      return openAiMessages;
    }, []);
  }

  private getLastAssistantText(messages: UIMessage[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant') {
        return this.getMessageText(messages[index]);
      }
    }

    return '';
  }

  private toResponsesInput(messages: UIMessage[]): string | ResponsesInputMessage[] {
    const input = this.toOpenAiMessages(messages);
    return input.length === 1 ? input[0].content : input;
  }

  private getMessageText(message: UIMessage): string {
    return (message.parts as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('');
  }

  private async fetchFollowUpQuestions(): Promise<string[]> {
    const response = await fetch(this.buildAiFollowUpsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildAiHeaders(),
      },
      body: JSON.stringify(this.buildAiRequestBody(false)),
    });

    if (!response.ok) {
      throw new Error((await response.text()) || 'Failed to fetch follow-up questions.');
    }

    const data = (await response.json()) as SuggestFollowUpsResponse;
    return data.follow_up_questions || [];
  }

  private buildAiFollowUpsUrl(): string {
    return `${this.buildAiServerBaseUrl()}/v1/suggest-follow-ups`;
  }

  private buildAiServerBaseUrl(): string {
    const aiServerUrl = environment.aiServerUrl;

    if (!aiServerUrl) {
      throw new Error('AI server URL is not configured.');
    }

    return aiServerUrl.replace(/\/$/, '');
  }

  private buildAiRequestBody(
    stream: boolean,
    messages = this.buildAiServerMessages(),
  ): AiRequestBody {
    const locationData = this.buildAiLocationData();

    return {
      model: environment.aiModel || 'cdp-gemini',
      stream,
      messages,
      metadata: {
        locationData,
        contextArea: this.contextArea,
      },
      locationData,
      contextArea: this.contextArea,
    };
  }

  private buildAiResponsesRequestBody(
    stream: boolean,
    input = this.buildAiResponsesInput(),
  ): AiResponsesRequestBody {
    const orgId = this.locationContext?.organizationId ?? null;

    return {
      model: environment.aiModel || 'cdp-gemini',
      stream,
      input,
      max_tokens: 900,
      orgId,
      metadata: {
        orgId,
        contextArea: this.contextArea,
      },
      contextArea: this.contextArea,
    };
  }

  private buildAiLocationData(): LocationProfile | null {
    if (
      !this.locationContext ||
      this.contextArea !== 'actions' ||
      !this.selectedActionHazardFilter
    ) {
      return this.locationContext;
    }

    const governmentActions = this.locationContext.governmentActions;
    if (!governmentActions) {
      return this.locationContext;
    }

    return {
      ...this.locationContext,
      governmentActions: {
        ...governmentActions,
        goals: (governmentActions.goals || []).filter((goal: AdaptationGoal) =>
          this.matchesSelectedActionHazard(goal.hazardsAddressed),
        ),
        actions: (governmentActions.actions || []).filter((action: AdaptationAction) =>
          this.matchesSelectedActionHazard(action.hazardsAddressed),
        ),
      },
    };
  }

  private buildAiServerMessages(): OpenAiMessage[] {
    const messages = this.conversationHistory().reduce<OpenAiMessage[]>(
      (openAiMessages, message) => {
        if (message.role === 'user') {
          openAiMessages.push({ role: 'user', content: message.content });
        }

        if (message.role === 'assistant') {
          openAiMessages.push({ role: 'assistant', content: this.stripHtml(message.content) });
        }

        return openAiMessages;
      },
      [],
    );

    if (messages.length) {
      return messages;
    }

    return [{ role: 'user', content: this.buildStarterPrompt() }];
  }

  private buildAiResponsesInput(): string | ResponsesInputMessage[] {
    const messages = this.buildAiServerMessages();
    return messages.length === 1 ? messages[0].content : messages;
  }

  private stripHtml(content: string): string {
    const parser = new DOMParser();
    return parser.parseFromString(content, 'text/html').documentElement.textContent || content;
  }

  private buildStarterPrompt(): string {
    const locationName =
      this.locationContext?.name ?? this.translateService.instant('askCdpAi.locationFallback');

    const focusByTab: Record<AskCdpAiContextArea, string> = {
      hazards: 'climate hazards, risk trends, exposure, and financial impact',
      actions: 'government adaptation actions, goals, projects, funding, and implementation status',
      solutions:
        'adaptation solutions, peer actions, local projects, and implementation opportunities',
    };

    return `Suggest follow-up questions for exploring ${
      focusByTab[this.contextArea]
    } in ${locationName}.`;
  }

  private textToUiMessageStream(content: string): ReadableStream<UIMessageChunk> {
    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        controller.enqueue({ type: 'start' });
        controller.enqueue({ type: 'start-step' });
        controller.enqueue({ type: 'text-start', id: 'text-1' });

        if (content) {
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: content });
        }

        controller.enqueue({ type: 'text-end', id: 'text-1' });
        controller.enqueue({ type: 'finish-step' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
  }

  private aiEventStreamToUiMessageStream(
    stream: ReadableStream<Uint8Array>,
  ): ReadableStream<UIMessageChunk> {
    const decoder = new TextDecoder();

    return new ReadableStream<UIMessageChunk>({
      start: async (controller) => {
        const reader = stream.getReader();
        let buffer = '';

        const emitEvents = () => {
          let eventBoundary = buffer.search(/\r?\n\r?\n/);

          while (eventBoundary >= 0) {
            const separator = buffer.slice(eventBoundary).match(/^\r?\n\r?\n/)?.[0] || '\n\n';
            const event = buffer.slice(0, eventBoundary).trim();
            buffer = buffer.slice(eventBoundary + separator.length);
            this.enqueueAiEventContent(event, controller);
            eventBoundary = buffer.search(/\r?\n\r?\n/);
          }
        };

        controller.enqueue({ type: 'start' });
        controller.enqueue({ type: 'start-step' });
        controller.enqueue({ type: 'text-start', id: 'text-1' });

        try {
          while (true) {
            const { value, done } = await reader.read();

            if (done) {
              buffer += decoder.decode();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            emitEvents();
          }

          if (buffer.trim()) {
            this.enqueueAiEventContent(buffer.trim(), controller);
          }

          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({ type: 'finish-step' });
          controller.enqueue({ type: 'finish' });
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });
  }

  private enqueueAiEventContent(
    event: string,
    controller: ReadableStreamDefaultController<UIMessageChunk>,
  ): void {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith('data:')) {
        continue;
      }

      const data = line.slice('data:'.length).trim();

      if (!data || data === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const content = this.extractAiStreamDelta(parsed);

        if (content) {
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: content });
        }
      } catch {
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: data });
      }
    }
  }

  private extractAiResponseText(data: any): string {
    if (typeof data?.output_text === 'string') {
      return data.output_text;
    }

    const outputText = data?.output
      ?.flatMap?.((item: any) => item?.content || [])
      ?.filter((part: any) => part?.type === 'output_text' && typeof part?.text === 'string')
      ?.map((part: any) => part.text)
      ?.join('');
    if (outputText) {
      return outputText;
    }

    return data?.choices?.[0]?.message?.content || '';
  }

  private extractAiStreamDelta(parsed: any): string {
    this.captureResponseSourceLocations(parsed);

    if (typeof parsed?.delta === 'string' && parsed?.type === 'response.output_text.delta') {
      return parsed.delta;
    }

    if (typeof parsed?.text === 'string' && parsed?.type === 'response.output_text.done') {
      return '';
    }

    return parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
  }

  private buildLocationContextKey(
    locationData: LocationProfile | null,
    contextArea: AskCdpAiContextArea,
    selectedActionHazardFilter: string | null,
  ): string | null {
    if (!locationData) {
      return null;
    }

    const { geometry: _geometry, ...locationContextForKey } = locationData;

    return JSON.stringify({
      contextArea,
      selectedActionHazardFilter,
      locationData: locationContextForKey,
    });
  }

  private matchesSelectedActionHazard(hazards: Hazard[] | null | undefined): boolean {
    if (!this.selectedActionHazardFilter) {
      return true;
    }

    return (
      hazards?.some(
        (hazard: Hazard) => this.hazardFilterKey(hazard) === this.selectedActionHazardFilter,
      ) ?? false
    );
  }

  private hazardFilterKey(hazard: Hazard): string {
    return `${hazard.hazardType}|${hazard.otherHazardDetails || ''}`;
  }

  private resetConversationState(): void {
    this.aiChat.stop();
    this.aiChat.messages = [];
    this.conversationHistory.set([]);
    this.disclosure.set(null);
    this.disclosureError.set(null);
    this.isDisclosureLoading.set(false);
    this.followUpQuestions.set([]);
    this.followUpError.set(null);
    this.isFollowUpLoading.set(false);
  }

  public parseToHtml(content: string): string {
    const dirty = marked(this.formatCitationMarkdown(content)) as string;
    return DOMPurify.sanitize(dirty);
  }

  private formatCitationMarkdown(content: string): string {
    const sourcesMatch = content.match(/(?:^|\n)Sources:\s*\n([\s\S]*)$/i);
    let formattedContent = content;
    let sourcesHtml = '';

    if (sourcesMatch?.[1]) {
      const parsedSources = sourcesMatch[1]
        .split(/\n+/)
        .map((line) => line.trim())
        .map((line) => line.match(/^\[\^(\d+)\]:\s*(.+)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match));

      const uniqueSources = parsedSources.reduce<Array<{ text: string }>>((sources, match) => {
        const [, , sourceText] = match;
        const existingSource = sources.find(
          (source) =>
            this.normalizeSourceText(source.text) === this.normalizeSourceText(sourceText),
        );

        if (existingSource) {
          return sources;
        }

        return [...sources, { text: sourceText }];
      }, []);

      if (uniqueSources.length) {
        formattedContent = content.slice(0, sourcesMatch.index ?? 0).trimEnd();
        const sourcesLabel = this.getSourcesLabel();
        const sourcesText = this.formatSourcesText(uniqueSources.map((source) => source.text));
        sourcesHtml = [
          `<section class="ai-sources" aria-label="${this.escapeHtml(sourcesLabel)}">`,
          `<p class="ai-sources-title">${this.escapeHtml(sourcesLabel)}</p>`,
          `<p>${sourcesText}</p>`,
          '</section>',
        ].join('');
      }
    }

    formattedContent = formattedContent.replace(/\[\^\d+\]/g, '');

    return sourcesHtml ? `${formattedContent}\n\n${sourcesHtml}` : formattedContent;
  }

  private normalizeSourceText(sourceText: string): string {
    return sourceText.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private getSourcesLabel(): string {
    const translatedLabel = this.translateService.instant('askCdpAi.sources');

    return translatedLabel && translatedLabel !== 'askCdpAi.sources' ? translatedLabel : 'Sources';
  }

  private linkifySourceText(sourceText: string): string {
    return this.escapeHtml(sourceText).replace(
      /`?(https?:\/\/[^\s`<]+)`?/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    );
  }

  private formatSourcesText(sourceTexts: string[]): string {
    const disclosureSources = sourceTexts
      .map((sourceText) => this.parseDisclosureSource(sourceText))
      .filter(
        (
          source,
        ): source is {
          locationName: string;
          year: string;
          disclosureLabel: string;
          suffix: string;
        } => Boolean(source),
      );

    if (disclosureSources.length === sourceTexts.length && disclosureSources.length > 0) {
      const firstSource = disclosureSources[0];
      const sameDisclosure = disclosureSources.every(
        (source) =>
          source.year === firstSource.year &&
          source.disclosureLabel === firstSource.disclosureLabel &&
          source.suffix === firstSource.suffix,
      );

      if (sameDisclosure) {
        const linkedLocations = disclosureSources.map((source) =>
          this.linkLocationName(source.locationName),
        );
        const disclosureLabel = firstSource.disclosureLabel.replace(
          /\bdisclosure\b/i,
          'disclosures',
        );
        return `${this.joinHtmlList(linkedLocations)} ${this.escapeHtml(
          `${firstSource.year} ${disclosureLabel}${firstSource.suffix}`,
        )}.`;
      }
    }

    return sourceTexts.map((sourceText) => this.linkifySourceText(sourceText)).join('; ');
  }

  private parseDisclosureSource(sourceText: string): {
    locationName: string;
    year: string;
    disclosureLabel: string;
    suffix: string;
  } | null {
    const match = sourceText.match(
      /^(.+?)\s+(\d{4})\s+(CDP(?:-ICLEI Track| States & Regions Questionnaire)? disclosure)(.*?)[.]?$/i,
    );
    if (!match) {
      return null;
    }

    const [, locationName, year, disclosureLabel, suffix] = match;
    return {
      locationName: locationName.trim(),
      year,
      disclosureLabel: disclosureLabel.trim(),
      suffix: suffix.trim(),
    };
  }

  private linkLocationName(locationName: string): string {
    const location = this.findSourceLocation(locationName);
    if (!location) {
      return this.escapeHtml(locationName);
    }

    const routeSegment = buildOrganizationSlugSegment(
      location.orgId,
      location.name,
      location.countryName,
    );
    return `<a href="/org/${this.escapeHtml(routeSegment)}/hazards">${this.escapeHtml(
      locationName,
    )}</a>`;
  }

  private findSourceLocation(locationName: string): SourceLocation | null {
    const sourceKey = this.normalizeSourceLocationName(locationName);
    return (
      this.latestResponseSourceLocations.find((location) => {
        const locationKey = this.normalizeSourceLocationName(location.name);
        return (
          sourceKey === locationKey ||
          locationKey.includes(sourceKey) ||
          sourceKey.includes(locationKey)
        );
      }) ?? null
    );
  }

  private normalizeSourceLocationName(value: string): string {
    return value
      .toLowerCase()
      .replace(/\b(city of|ville de|municipality of|state of)\b/g, '')
      .replace(/\b(ny|qc|usa|united states of america|united states)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private joinHtmlList(items: string[]): string {
    if (items.length <= 1) {
      return items[0] ?? '';
    }
    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  private currentSourceLocations(): SourceLocation[] {
    if (!this.locationContext?.organizationId || !this.locationContext.name) {
      return [];
    }
    return [
      {
        orgId: this.locationContext.organizationId,
        name: this.locationContext.name,
        countryName: this.locationContext.countryName,
      },
    ];
  }

  private captureResponseSourceLocations(event: any): void {
    const steps = event?.steps ?? event?.response?.steps;
    if (!Array.isArray(steps)) {
      return;
    }

    const cloudSqlFetch = steps.find((step) => step?.type === 'cloudsql_fetch');
    const locations = cloudSqlFetch?.data?.locations;
    if (!Array.isArray(locations)) {
      return;
    }

    const nextLocations = locations
      .filter((location) => location?.orgId && location?.name)
      .map((location) => ({
        orgId: Number(location.orgId),
        name: String(location.name),
        countryName: location.countryName ?? null,
      }));
    if (nextLocations.length) {
      this.latestResponseSourceLocations = nextLocations;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
