import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { PosthogService } from '../../core/analytics/posthog.service';
import { LocationService } from '../../shared/services/location.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { AskCdpAiComponent } from './ask-cdp-ai.component';

describe('AskCdpAiComponent', () => {
  let component: AskCdpAiComponent;
  let fixture: ComponentFixture<AskCdpAiComponent>;
  let askCdpAiService: jasmine.SpyObj<AskCdpAiService>;
  let posthog: jasmine.SpyObj<PosthogService>;
  let locationService: jasmine.SpyObj<LocationService>;

  beforeEach(async () => {
    askCdpAiService = jasmine.createSpyObj<AskCdpAiService>(
      'AskCdpAiService',
      [
        'clearSession',
        'loadStarterQuestions',
        'setLocationContext',
        'setReferenceOrganizations',
        'sendChatQuery',
      ],
      {
        conversationHistory: signal([]),
        isDisclosureLoading: signal(false),
        disclosureError: signal(null),
        followUpQuestions: signal([]),
        isFollowUpLoading: signal(false),
        followUpError: signal(null),
      },
    );
    askCdpAiService.loadStarterQuestions.and.returnValue(of(void 0));
    askCdpAiService.sendChatQuery.and.returnValue(of(''));
    posthog = jasmine.createSpyObj<PosthogService>('PosthogService', ['capture']);
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getAllLocationNames',
    ]);
    locationService.getAllLocationNames.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AskCdpAiComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AskCdpAiService, useValue: askCdpAiService },
        { provide: PosthogService, useValue: posthog },
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

  it('prompts users to select a location when no location context exists', () => {
    fixture.detectChanges();

    const selector: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-organization-selector"]',
    );
    expect(selector.textContent).toContain('Select a location');
    expect(selector.textContent).not.toContain('this location');
  });

  it('syncs multiple selected reference organizations with the AI service', () => {
    fixture.detectChanges();
    askCdpAiService.setReferenceOrganizations.calls.reset();
    askCdpAiService.loadStarterQuestions.calls.reset();

    component.onReferenceOrganizationsChange([
      {
        organizationId: 31173,
        name: 'City of New York, NY',
        country: 'United States of America',
        disclosesToCDP: true,
        isReportingLeader: false,
      },
      {
        organizationId: 10894,
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

  it('collapses starter suggestions outside the input section by default', () => {
    askCdpAiService.followUpQuestions.set([
      'Which hazards are expected to have the highest financial impact?',
      'What hazards are on the rise?',
    ]);

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.chat-input-section .overflow-y-auto [data-testid="ask-ai-suggestion"]',
      ),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll(
        '.chat-input-section [data-testid="ask-ai-suggestion"]',
      ).length,
    ).toBe(0);

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-suggestions-toggle"]',
    );
    expect(toggle.textContent).toContain('2 suggestions');

    toggle.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '#ask-ai-starter-suggestions [data-testid="ask-ai-suggestion"]',
      ).length,
    ).toBe(2);
  });
});
