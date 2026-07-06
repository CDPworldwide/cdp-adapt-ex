import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import type { LocationProfile } from '@pac-api/client';
import { BehaviorSubject, of } from 'rxjs';

import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { PosthogService } from '../../core/analytics/posthog.service';
import { GlobalSearchService } from '../../core/global-search/global-search.service';
import { LocationService } from '../../shared/services/location.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { ChatPageComponent } from './chat-page.component';

describe('ChatPageComponent', () => {
  let fixture: ComponentFixture<ChatPageComponent>;
  let askCdpAiService: jasmine.SpyObj<AskCdpAiService>;
  let routeQueryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let locationService: jasmine.SpyObj<LocationService>;
  let mobileKeyboardViewportService: jasmine.SpyObj<MobileKeyboardViewportService>;

  const mockLocationData = {
    organizationId: 10894,
    name: 'City of Los Angeles, CA',
  } as LocationProfile;

  beforeEach(async () => {
    routeQueryParamMap$ = new BehaviorSubject(convertToParamMap({}));
    askCdpAiService = jasmine.createSpyObj<AskCdpAiService>(
      'AskCdpAiService',
      [
        'clearSession',
        'loadStarterQuestions',
        'sendChatQuery',
        'setLocationContext',
        'setReferenceOrganizations',
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

    mobileKeyboardViewportService = jasmine.createSpyObj<MobileKeyboardViewportService>(
      'MobileKeyboardViewportService',
      ['keepElementVisible', 'startTracking'],
    );
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getAllLocationNames',
      'getLocationByOrganizationId',
    ]);
    locationService.getAllLocationNames.and.returnValue(of([]));
    locationService.getLocationByOrganizationId.and.returnValue(of(mockLocationData));

    await TestBed.configureTestingModule({
      imports: [ChatPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: AskCdpAiService, useValue: askCdpAiService },
        {
          provide: LocationService,
          useValue: locationService,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: routeQueryParamMap$.asObservable(),
          },
        },
        {
          provide: MobileKeyboardViewportService,
          useValue: mobileKeyboardViewportService,
        },
        {
          provide: PosthogService,
          useValue: jasmine.createSpyObj<PosthogService>('PosthogService', ['capture']),
        },
        {
          provide: GlobalSearchService,
          useValue: jasmine.createSpyObj<GlobalSearchService>('GlobalSearchService', ['open']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
  });

  it('mounts the AI chat panel with generic context and no drawer close button', () => {
    expect(mobileKeyboardViewportService.startTracking).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-ask-cdp-ai')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="ask-ai-toggle"]')).toBeNull();
  });

  it('uses the shared AI chat component without loading suggestions', () => {
    askCdpAiService.followUpQuestions.set(['What hazards are on the rise?']);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-ask-cdp-ai')).not.toBeNull();
    expect(askCdpAiService.loadStarterQuestions).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="ask-ai-suggestions-toggle"]'),
    ).toBeNull();
  });

  it('renders the styled standalone chat layout', () => {
    expect(fixture.nativeElement.querySelector('app-header')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-tool-shell app-ask-cdp-ai')).not.toBeNull();
  });

  it('loads organization context from the organizationId query parameter', () => {
    routeQueryParamMap$.next(convertToParamMap({ organizationId: '10894' }));
    fixture.detectChanges();

    expect(locationService.getLocationByOrganizationId).toHaveBeenCalledWith('10894');
    expect(fixture.componentInstance.locationData).toEqual(mockLocationData);
  });
});
