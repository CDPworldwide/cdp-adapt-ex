import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { LocationService } from '../../shared/services/location.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { AskCdpAiComponent } from './ask-cdp-ai.component';

describe('AskCdpAiComponent', () => {
  let component: AskCdpAiComponent;
  let fixture: ComponentFixture<AskCdpAiComponent>;
  let askCdpAiService: jasmine.SpyObj<AskCdpAiService>;
  let posthog: jasmine.SpyObj<AnalyticsService>;
  let locationService: jasmine.SpyObj<LocationService>;
  let translate: TranslateService;

  beforeEach(async () => {
    askCdpAiService = jasmine.createSpyObj<AskCdpAiService>(
      'AskCdpAiService',
      [
        'clearSession',
        'loadStarterQuestions',
        'setLocationContext',
        'setReferenceOrganizations',
        'sendChatQuery',
        'loadLocalTestChat',
      ],
      {
        conversationHistory: signal([]),
        isDisclosureLoading: signal(false),
        disclosureError: signal(null),
        followUpQuestions: signal([]),
        isFollowUpLoading: signal(false),
        followUpError: signal(null),
        debugInfo: signal(null),
      },
    );
    askCdpAiService.loadStarterQuestions.and.returnValue(of(void 0));
    askCdpAiService.sendChatQuery.and.returnValue(of(''));
    posthog = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['capture']);
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getAllLocationNames',
    ]);
    locationService.getAllLocationNames.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AskCdpAiComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AskCdpAiService, useValue: askCdpAiService },
        { provide: AnalyticsService, useValue: posthog },
        { provide: LocationService, useValue: locationService },
        {
          provide: MobileKeyboardViewportService,
          useValue: jasmine.createSpyObj<MobileKeyboardViewportService>(
            'MobileKeyboardViewportService',
            ['keepElementVisible'],
          ),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AskCdpAiComponent);
    component = fixture.componentInstance;

    translate = TestBed.inject(TranslateService);
    translate.use('en');
    translate.setTranslation('en', {
      askCdpAi: {
        buttonText: 'Ask the AI Explorer',
        betaDisclaimer:
          'Beta: Trained on CDP disclosure data from cities, states, and regions. Results may be inaccurate and are not guaranteed.',
        emptyState: {
          title: 'Ask a question about {{location}}.',
          description: 'Use the input below to ask about risks, actions, or climate context for this location.',
        },
        locationFallback: 'this location',
        input: {
          placeholder: 'Ask the AI Explorer...',
        },
        organizationSelector: {
          label: 'Ask a question about',
          defaultDisplayName: 'Select a location',
          addAnotherLocation: 'Add another location',
          searchPlaceholder: 'Search organizations',
          removeOrganization: 'Remove {{name}}',
        },
      },
    });
  });

  it('captures sanitized query text when a manual chat query is submitted', () => {
    component.contextArea = 'solutions';
    component.locationData = {
      organizationId: 12345,
      name: 'Athens',
      countryName: 'Greece',
      hazards: { hazards: [] } as any,
      governmentActions: { actions: [], goals: [], projects: [] },
    } as any;
    component.userQuery = '  How can Athens reduce heat?\n\t  ';

    component.sendQuery();

    expect(posthog.capture).toHaveBeenCalledWith(
      'ai_chat_query_submitted',
      jasmine.objectContaining({
        location_id: 12345,
        location_name: 'Athens',
        country: 'Greece',
        context_area: 'solutions',
        query: 'How can Athens reduce heat?',
        query_length: 27,
        source: 'manual',
      }),
    );
    expect(askCdpAiService.sendChatQuery).toHaveBeenCalledWith('How can Athens reduce heat?');
    expect(component.userQuery).toBe('');
  });

  it('loads starter questions when initialized with its context', () => {
    component.contextArea = 'hazards';

    fixture.detectChanges();

    expect(askCdpAiService.setLocationContext).toHaveBeenCalledWith(null, 'hazards');
    expect(askCdpAiService.loadStarterQuestions).toHaveBeenCalled();
  });

  it('does not load or render suggestions when suggestions are disabled', () => {
    component.showSuggestions = false;
    askCdpAiService.followUpQuestions.set(['What hazards are on the rise?']);

    fixture.detectChanges();

    expect(askCdpAiService.setLocationContext).toHaveBeenCalledWith(null, 'hazards');
    expect(askCdpAiService.loadStarterQuestions).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="ask-ai-suggestions-toggle"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="ask-ai-suggestion"]')).toBeNull();
  });

  it('prompts users to select a location when no location context exists', () => {
    fixture.detectChanges();

    const selector: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-organization-selector"]',
    );
    expect(selector.textContent).toContain('Select a location');
    expect(selector.textContent).not.toContain('this location');
  });

  it('keeps the comparison selector visible when the chat has messages', () => {
    askCdpAiService.conversationHistory.set([
      { role: 'user', content: 'What hazards are on the rise?' },
      { role: 'assistant', content: 'Urban flooding is a reported concern.' },
    ]);

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="ask-ai-organization-selector"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('What hazards are on the rise?');
  });

  it('syncs multiple selected reference organizations with the AI service', () => {
    fixture.detectChanges();
    askCdpAiService.setReferenceOrganizations.calls.reset();
    askCdpAiService.loadStarterQuestions.calls.reset();

    component.onReferenceOrganizationsChange([
      {
        organizationId: 31173,
        slug: '31173-city-of-new-york-ny-united-states-of-america',
        name: 'City of New York, NY',
        country: 'United States of America',
        disclosesToCDP: true,
        isReportingLeader: false,
      },
      {
        organizationId: 10894,
        slug: '10894-city-of-los-angeles-ca-united-states-of-america',
        name: 'City of Los Angeles, CA',
        country: 'United States of America',
        disclosesToCDP: true,
        isReportingLeader: false,
      },
    ]);

    expect(askCdpAiService.setReferenceOrganizations).toHaveBeenCalledWith([
      {
        organizationId: 31173,
        name: 'City of New York, NY',
        country: 'United States of America',
      },
      {
        organizationId: 10894,
        name: 'City of Los Angeles, CA',
        country: 'United States of America',
      },
    ]);
    expect(askCdpAiService.loadStarterQuestions).toHaveBeenCalled();
  });

  it('collapses starter suggestions above the input by default', () => {
    askCdpAiService.followUpQuestions.set([
      'Which hazards are expected to have the highest financial impact?',
      'What hazards are on the rise?',
    ]);

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.chat-input-section [data-testid="ask-ai-suggestion"]',
      ).length,
    ).toBe(0);

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.chat-input-section [data-testid="ask-ai-suggestions-toggle"]',
    );
    expect(toggle.textContent).toContain('2 suggestions');

    toggle.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.chat-input-section #ask-ai-starter-suggestions [data-testid="ask-ai-suggestion"]',
      ).length,
    ).toBe(2);
  });

  it('collapses follow-up suggestions after an assistant response by default', () => {
    askCdpAiService.conversationHistory.set([
      { role: 'user', content: 'What hazards are on the rise?' },
      { role: 'assistant', content: 'Urban flooding is a reported concern.' },
    ]);
    askCdpAiService.followUpQuestions.set([
      'Which hazards are expected to have the highest financial impact?',
      'What is the projected risk level and trend for urban flooding?',
    ]);

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.chat-input-section #ask-ai-starter-suggestions [data-testid="ask-ai-suggestion"]',
      ).length,
    ).toBe(0);

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-suggestions-toggle"]',
    );
    expect(toggle.textContent).toContain('2 suggestions');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.chat-input-section #ask-ai-starter-suggestions [data-testid="ask-ai-suggestion"]',
      ).length,
    ).toBe(2);
  });

  it('collapses suggestions when a query is submitted', () => {
    askCdpAiService.followUpQuestions.set(['What hazards are on the rise?']);
    fixture.detectChanges();

    component.toggleStarterQuestions();
    component.userQuery = 'Which hazards are highest risk?';
    component.sendQuery();
    fixture.detectChanges();

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-suggestions-toggle"]',
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-suggestion"]').length,
    ).toBe(0);
  });

  it('does not ask the service to load follow-ups after a manual query when suggestions are disabled', () => {
    component.showSuggestions = false;
    component.userQuery = 'Which hazards are highest risk?';

    component.sendQuery();

    expect(askCdpAiService.sendChatQuery).toHaveBeenCalledWith(
      'Which hazards are highest risk?',
      false,
    );
  });

  it('renders a local-only test chat button when enabled', () => {
    component.showLocalTestControls = true;
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-load-test-chat"]',
    );
    expect(button.textContent).toContain('Load test chat');

    button.click();

    expect(askCdpAiService.loadLocalTestChat).toHaveBeenCalled();
  });

  it('renders safe debug metadata when debug mode is enabled', () => {
    askCdpAiService.debugInfo.set({
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      promptName: 'system_prompt.md',
      promptSourceKind: 'remote',
      contextArea: 'hazards',
      organizationIds: [3417, 919095],
      comparisonLocationCount: 2,
      latencyMs: 1234,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      stepTypes: ['location_context', 'cloudsql_fetch'],
    });

    fixture.detectChanges();

    const debugPanel: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-debug-metadata"]',
    );
    expect(debugPanel).not.toBeNull();
    expect(debugPanel.textContent).toContain('Debug metadata');
    expect(debugPanel.textContent).toContain('0123456789abcdef0123456789abcdef');
    expect(debugPanel.textContent).toContain('system_prompt.md / remote');
    expect(debugPanel.textContent).toContain('1234 ms');
    expect(debugPanel.textContent).toContain('15 total (10 in, 5 out)');
  });
});
