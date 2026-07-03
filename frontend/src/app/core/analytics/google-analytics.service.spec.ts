import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { environment } from '@env/environment';
import { GoogleAnalyticsService } from './google-analytics.service';

describe('GoogleAnalyticsService', () => {
  const originalGoogleAnalytics = { ...environment.googleAnalytics };
  const originalGtag = (window as any).gtag;
  let routerEvents: Subject<NavigationEnd>;
  let gtag: jasmine.Spy;

  beforeEach(() => {
    routerEvents = new Subject<NavigationEnd>();
    gtag = jasmine.createSpy('gtag');
    (window as any).gtag = gtag;
    Object.assign(environment.googleAnalytics, {
      enabled: true,
      measurementId: 'G-HF1JYR06EC',
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: {
            events: routerEvents.asObservable(),
          },
        },
      ],
    });
  });

  afterEach(() => {
    Object.assign(environment.googleAnalytics, originalGoogleAnalytics);
    (window as any).gtag = originalGtag;
    localStorage.clear();
  });

  it('captures allowed events with stored user type', () => {
    localStorage.setItem('cdp-user-role', 'business');
    const service = TestBed.inject(GoogleAnalyticsService);

    service.init();
    service.capture('location_viewed', { country: 'Greece' });

    expect(gtag).toHaveBeenCalledWith('event', 'location_viewed', {
      country: 'Greece',
      user_type: 'business',
    });
  });

  it('does not capture detailed-only events', () => {
    const service = TestBed.inject(GoogleAnalyticsService);

    service.init();
    service.capture('hazard_detail_expanded', { hazard_type: 'EXTREME_HEAT' });

    expect(gtag).not.toHaveBeenCalled();
  });

  it('captures Angular route changes as Google Analytics page views', () => {
    const service = TestBed.inject(GoogleAnalyticsService);

    service.init();
    routerEvents.next(new NavigationEnd(1, '/org/athens', '/org/athens'));

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      jasmine.objectContaining({
        page_location: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title,
      }),
    );
  });
});
