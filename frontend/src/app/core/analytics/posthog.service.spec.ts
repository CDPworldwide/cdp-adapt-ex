import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import posthog from 'posthog-js';

import { environment } from '@env/environment';
import { PosthogService } from './posthog.service';

describe('PosthogService', () => {
  let service: PosthogService;
  let captureSpy: jasmine.Spy;
  const originalPosthogConfig = { ...environment.posthog };

  beforeEach(() => {
    localStorage.clear();
    captureSpy = spyOn(posthog, 'capture');

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    service = TestBed.inject(PosthogService);
    (service as unknown as { initialized: boolean }).initialized = true;
  });

  afterEach(() => {
    localStorage.clear();
    Object.assign(environment.posthog, originalPosthogConfig);
  });

  it('enables pageleave capture when automatic pageviews are disabled', () => {
    const initSpy = spyOn(posthog, 'init');
    Object.assign(environment.posthog, {
      enabled: true,
      key: 'phc_test',
      host: '/_cdp',
      uiHost: 'https://eu.posthog.com',
    });
    (service as unknown as { initialized: boolean }).initialized = false;

    service.init();

    expect(initSpy).toHaveBeenCalledWith(
      'phc_test',
      jasmine.objectContaining({
        api_host: '/_cdp',
        ui_host: 'https://eu.posthog.com',
        capture_pageview: false,
        capture_pageleave: true,
      }),
    );
  });

  it('adds the stored user type to captured events', () => {
    localStorage.setItem('cdp-user-role', 'ngo');

    service.capture('search_location_selected', { location_name: 'Athens' });

    expect(captureSpy).toHaveBeenCalledWith('search_location_selected', {
      location_name: 'Athens',
      user_type: 'ngo',
    });
  });

  it('does not override an explicit user type on captured events', () => {
    localStorage.setItem('cdp-user-role', 'ngo');

    service.capture('user_role_selected', { user_type: 'business' });

    expect(captureSpy).toHaveBeenCalledWith('user_role_selected', { user_type: 'business' });
  });
});
