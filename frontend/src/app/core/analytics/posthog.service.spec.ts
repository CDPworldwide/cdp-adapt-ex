import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import posthog from 'posthog-js';

import { environment } from '@env/environment';
import { AnalyticsEvent } from './analytics-events';
import { PosthogService, isPosthogHostAllowed } from './posthog.service';

describe('PosthogService', () => {
  let service: PosthogService;
  let captureSpy: jasmine.Spy;
  const originalEnvironmentConfig = {
    isDebugMode: environment.isDebugMode,
    posthog: { ...environment.posthog },
    sentry: { ...environment.sentry },
  };

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
    environment.isDebugMode = originalEnvironmentConfig.isDebugMode;
    Object.assign(environment.posthog, originalEnvironmentConfig.posthog);
    Object.assign(environment.sentry, originalEnvironmentConfig.sentry);
    delete window.__cdpAnalyticsDebug;
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

  it('captures a non-secret analytics initialization health event', () => {
    spyOn(posthog, 'init');
    Object.assign(environment.posthog, {
      enabled: true,
      key: 'phc_test',
      host: '/_cdp',
      uiHost: 'https://eu.posthog.com',
      sessionReplayEnabled: true,
    });
    Object.assign(environment.sentry, {
      environment: 'production',
      release: 'abc123',
    });
    (service as unknown as { initialized: boolean }).initialized = false;

    service.init();

    expect(captureSpy).toHaveBeenCalledWith(
      AnalyticsEvent.AnalyticsInitialized,
      jasmine.objectContaining({
        initialized: true,
        enabled: true,
        keyConfigured: true,
        hostAllowed: true,
        apiHost: '/_cdp',
        uiHost: 'https://eu.posthog.com',
        capturePageleave: true,
        sessionReplayEnabled: true,
        release: 'abc123',
        environment: 'production',
      }),
    );
  });

  it('exposes local diagnostics when debug mode is enabled', () => {
    environment.isDebugMode = true;
    Object.assign(environment.posthog, {
      enabled: false,
      key: '',
      host: '/_cdp',
      uiHost: 'https://eu.posthog.com',
    });
    (service as unknown as { initialized: boolean }).initialized = false;

    service.init();

    expect(window.__cdpAnalyticsDebug).toEqual(jasmine.any(Function));
    expect(window.__cdpAnalyticsDebug?.()).toEqual(
      jasmine.objectContaining({
        initialized: false,
        enabled: false,
        keyConfigured: false,
        hostAllowed: true,
        apiHost: '/_cdp',
        uiHost: 'https://eu.posthog.com',
        debug: true,
      }),
    );
  });

  it('allows analytics only on the canonical production and local development hosts', () => {
    expect(isPosthogHostAllowed('cdp-action-explorer.net')).toBeTrue();
    expect(isPosthogHostAllowed('localhost')).toBeTrue();
    expect(isPosthogHostAllowed('127.0.0.1')).toBeTrue();
    expect(isPosthogHostAllowed('frontend-prod-pbybuiwoxq-uc.a.run.app')).toBeFalse();
    expect(isPosthogHostAllowed('frontend-dev-pbybuiwoxq-uc.a.run.app')).toBeFalse();
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
