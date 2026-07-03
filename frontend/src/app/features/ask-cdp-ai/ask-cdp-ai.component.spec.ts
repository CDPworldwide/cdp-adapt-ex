import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { AnalyticsService } from '../../core/analytics/analytics.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { AskCdpAiComponent } from './ask-cdp-ai.component';

describe('AskCdpAiComponent', () => {
  let component: AskCdpAiComponent;
  let fixture: ComponentFixture<AskCdpAiComponent>;
  let askCdpAiService: jasmine.SpyObj<AskCdpAiService>;
  let posthog: jasmine.SpyObj<AnalyticsService>;

  beforeEach(async () => {
    askCdpAiService = jasmine.createSpyObj<AskCdpAiService>(
      'AskCdpAiService',
      ['clearSession', 'setLocationContext', 'sendChatQuery'],
      {
        conversationHistory: signal([]),
        isDisclosureLoading: signal(false),
        disclosureError: signal(null),
        followUpQuestions: signal([]),
        followUpError: signal(null),
      },
    );
    askCdpAiService.sendChatQuery.and.returnValue(of(''));
    posthog = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['capture']);

    await TestBed.configureTestingModule({
      imports: [AskCdpAiComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AskCdpAiService, useValue: askCdpAiService },
        { provide: AnalyticsService, useValue: posthog },
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
});
