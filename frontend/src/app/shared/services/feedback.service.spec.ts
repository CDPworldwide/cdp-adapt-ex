import { SecurityContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { AnalyticsService } from '../../core/analytics/analytics.service';
import { FeedbackService } from './feedback.service';
import { LanguageService } from './language.service';

describe('FeedbackService', () => {
  let analytics: jasmine.SpyObj<AnalyticsService>;
  let router: { url: string };
  let sanitizer: DomSanitizer;
  let service: FeedbackService;

  beforeEach(() => {
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['capture']);
    router = { url: '/' };

    TestBed.configureTestingModule({
      providers: [
        FeedbackService,
        { provide: AnalyticsService, useValue: analytics },
        {
          provide: LanguageService,
          useValue: {
            currentLang: () => 'en',
          },
        },
        { provide: Router, useValue: router },
      ],
    });

    sanitizer = TestBed.inject(DomSanitizer);
    service = TestBed.inject(FeedbackService);
  });

  it('passes page context into the Typeform embed URL', () => {
    router.url = '/';
    service.open();

    const hiddenFields = typeformHiddenFields();

    expect(hiddenFields.get('path')).toBe('/');
    expect(hiddenFields.get('language')).toBe('en');
    expect(hiddenFields.get('timestamp_client')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(hiddenFields.get('page_url')).toContain(window.location.origin);
    expect(analytics.capture).toHaveBeenCalledWith('feedback_opened', {
      path: '/',
      language: 'en',
      viewport: jasmine.any(String),
      location_id: undefined,
      location_name: undefined,
      active_tab: undefined,
    });
  });

  it('passes location context into the Typeform embed URL for organization pages', () => {
    router.url = '/org/12345-minas-gerais/hazards?foo=bar#section';
    service.setLocationContext({
      activeTab: 'hazards',
      locationId: 12345,
      locationName: 'Minas Gerais',
    });

    service.open();

    const hiddenFields = typeformHiddenFields();

    expect(hiddenFields.get('path')).toBe('/org/12345-minas-gerais/hazards');
    expect(hiddenFields.get('location_id')).toBe('12345');
    expect(hiddenFields.get('location_name')).toBe('Minas Gerais');
    expect(hiddenFields.get('active_tab')).toBe('hazards');
    expect(analytics.capture).toHaveBeenCalledWith('feedback_opened', {
      path: '/org/12345-minas-gerais/hazards',
      language: 'en',
      viewport: jasmine.any(String),
      location_id: '12345',
      location_name: 'Minas Gerais',
      active_tab: 'hazards',
    });
  });

  function typeformHiddenFields(): URLSearchParams {
    const embedUrl = sanitizer.sanitize(SecurityContext.RESOURCE_URL, service.embedUrl());
    expect(embedUrl).toContain('https://cdp-worldwide.typeform.com/to/h0Og6Gme#');

    return new URLSearchParams(new URL(embedUrl!).hash.slice(1));
  }
});
