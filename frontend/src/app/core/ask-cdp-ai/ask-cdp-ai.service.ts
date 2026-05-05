import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { tap, map, catchError, switchMap } from 'rxjs/operators';
import { type LocationProfileInput } from '@pac-api/client';
import { Chat } from '@ai-sdk/angular';
import { type ChatTransport, type UIMessage, type UIMessageChunk } from 'ai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '@env/environment';

type ConversationMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type OpenAiMessage = { role: 'user' | 'assistant'; content: string };
type SuggestFollowUpsResponse = { follow_up_questions?: string[] };
export type AskCdpAiContextArea = 'hazards' | 'actions' | 'solutions';
type AiRequestBody = {
  model: string;
  stream: boolean;
  messages: OpenAiMessage[];
  metadata: {
    locationData: LocationProfileInput | null;
    contextArea: AskCdpAiContextArea;
  };
  locationData: LocationProfileInput | null;
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

  private locationContext: LocationProfileInput | null = null;
  private contextArea: AskCdpAiContextArea = 'hazards';
  private locationContextKey: string | null = null;
  private readonly aiChat = this.createAiChat();

  setLocationContext(
    locationData: LocationProfileInput | null | undefined,
    contextArea: AskCdpAiContextArea = 'hazards',
  ): void {
    const nextLocationContext = locationData ?? null;
    const nextLocationContextKey = this.buildLocationContextKey(nextLocationContext, contextArea);

    if (nextLocationContextKey === this.locationContextKey) {
      this.locationContext = nextLocationContext;
      this.contextArea = contextArea;
      return;
    }

    this.locationContext = nextLocationContext;
    this.contextArea = contextArea;
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
          body: JSON.stringify(this.buildAiRequestBody(true, this.toOpenAiMessages(messages))),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error((await response.text()) || 'Failed to fetch the chat response.');
        }

        if (!response.body) {
          throw new Error('The response body is empty.');
        }

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          return this.textToUiMessageStream(data.choices?.[0]?.message?.content || '');
        }

        return this.openAiEventStreamToUiMessageStream(response.body);
      },
      reconnectToStream: async () => null,
    };
  }

  private buildAiChatUrl(): string {
    const aiServerUrl = environment.aiServerUrl || environment.baseUrl;
    return `${aiServerUrl.replace(/\/$/, '')}/v1/chat/completions`;
  }

  private buildAiHeaders(): Record<string, string> {
    const apiKey = 'apiKey' in environment ? environment.apiKey : '';
    if (!apiKey) {
      return {};
    }

    const apiKeyHeaderName =
      'apiKeyHeaderName' in environment ? environment.apiKeyHeaderName : 'X-API-Key';

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

  private getMessageText(message: UIMessage): string {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
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
    const aiServerUrl = environment.aiServerUrl || environment.baseUrl;
    return `${aiServerUrl.replace(/\/$/, '')}/v1/suggest-follow-ups`;
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

  private buildAiLocationData(): LocationProfileInput | null {
    if (!this.locationContext) {
      return null;
    }

    return JSON.parse(JSON.stringify(this.locationContext)) as LocationProfileInput;
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

    return `Suggest follow-up questions for exploring ${focusByTab[this.contextArea]} in ${locationName}.`;
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

  private openAiEventStreamToUiMessageStream(
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
            this.enqueueOpenAiEventContent(event, controller);
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
            this.enqueueOpenAiEventContent(buffer.trim(), controller);
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

  private enqueueOpenAiEventContent(
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
        const content =
          parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';

        if (content) {
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: content });
        }
      } catch {
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: data });
      }
    }
  }

  private buildLocationContextKey(
    locationData: LocationProfileInput | null,
    contextArea: AskCdpAiContextArea,
  ): string | null {
    if (!locationData) {
      return null;
    }

    return `${locationData.organizationId}|${locationData.name}|${locationData.countryName}|${locationData.lat}|${locationData.lng}|${contextArea}`;
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
    const dirty = marked(content) as string;
    return DOMPurify.sanitize(dirty);
  }
}
