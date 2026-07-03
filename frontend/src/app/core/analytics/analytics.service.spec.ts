import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from './analytics.service';
import { GoogleAnalyticsService } from './google-analytics.service';
import { PosthogService } from './posthog.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let googleAnalytics: jasmine.SpyObj<GoogleAnalyticsService>;
  let posthog: jasmine.SpyObj<PosthogService>;

  beforeEach(() => {
    googleAnalytics = jasmine.createSpyObj<GoogleAnalyticsService>('GoogleAnalyticsService', [
      'capture',
      'init',
    ]);
    posthog = jasmine.createSpyObj<PosthogService>('PosthogService', [
      'capture',
      'captureException',
      'init',
      'register',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: GoogleAnalyticsService, useValue: googleAnalytics },
        { provide: PosthogService, useValue: posthog },
      ],
    });

    service = TestBed.inject(AnalyticsService);
  });

  it('initializes both analytics destinations', () => {
    service.init();

    expect(posthog.init).toHaveBeenCalled();
    expect(googleAnalytics.init).toHaveBeenCalled();
  });

  it('sends full event payloads to PostHog and curated payloads to Google Analytics', () => {
    service.capture('ai_chat_query_submitted', {
      context_area: 'solutions',
      country: 'Greece',
      query: 'How can Athens reduce heat?',
      query_length: 27,
      source: 'manual',
      user_type: 'business',
    });

    expect(posthog.capture).toHaveBeenCalledWith('ai_chat_query_submitted', {
      context_area: 'solutions',
      country: 'Greece',
      query: 'How can Athens reduce heat?',
      query_length: 27,
      source: 'manual',
      user_type: 'business',
    });
    expect(googleAnalytics.capture).toHaveBeenCalledWith('ai_chat_query_submitted', {
      context_area: 'solutions',
      country: 'Greece',
      query_length: 27,
      source: 'manual',
      user_type: 'business',
    });
  });

  it('keeps detailed-only events out of Google Analytics', () => {
    service.capture('hazard_detail_expanded', {
      hazard_type: 'EXTREME_HEAT',
      country: 'Greece',
    });

    expect(posthog.capture).toHaveBeenCalled();
    expect(googleAnalytics.capture).not.toHaveBeenCalled();
  });
});
