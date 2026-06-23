import { Injectable, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import posthog from 'posthog-js';
import { filter } from 'rxjs';

import { environment } from '@env/environment';
import { readStoredUserRole } from './user-role';

type PosthogEventProperties = Record<string, string | number | boolean | null | undefined>;

export function isPosthogHostAllowed(hostname: string): boolean {
  return hostname === 'cdp-action-explorer.net' || hostname === 'localhost' || hostname === '127.0.0.1';
}

@Injectable({ providedIn: 'root' })
export class PosthogService {
  private initialized = false;
  private ngZone = inject(NgZone);
  private router = inject(Router);

  init(): void {
    const config = environment.posthog;

    if (
      this.initialized ||
      !config?.enabled ||
      !config.key ||
      !isPosthogHostAllowed(window.location.hostname)
    ) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      posthog.init(config.key, {
        api_host: config.host,
        ui_host: config.uiHost,
        defaults: '2026-01-30',
        capture_pageview: false,
        capture_pageleave: true,
        capture_exceptions: true,
        autocapture: {
          url_allowlist: [
            /^https:\/\/cdp-action-explorer\.net(?:\/.*)?$/,
            /^https?:\/\/localhost:\d+(?:\/.*)?$/,
            /^https?:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/,
          ],
        },
        disable_session_recording: config.sessionReplayEnabled === false,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '*',
          blockSelector: '.sensitive-data, [data-ph-no-capture]',
        },
        debug: environment.isDebugMode,
      });
    });

    this.initialized = true;
    this.registerStoredUserType();
    this.capturePageView();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.capturePageView();
    });
  }

  capture(eventName: string, properties?: PosthogEventProperties): void {
    if (!this.initialized) {
      return;
    }

    posthog.capture(eventName, this.withStoredUserType(properties));
  }

  register(properties: PosthogEventProperties): void {
    if (!this.initialized) {
      return;
    }

    posthog.register(properties);
  }

  captureException(error: unknown): void {
    if (!this.initialized) {
      return;
    }

    posthog.captureException(error);
  }

  private capturePageView(): void {
    posthog.capture(
      '$pageview',
      this.withStoredUserType({
        $current_url: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
      }),
    );
  }

  private registerStoredUserType(): void {
    const userType = readStoredUserRole();
    if (userType) {
      posthog.register({ user_type: userType });
    }
  }

  private withStoredUserType(properties: PosthogEventProperties = {}): PosthogEventProperties {
    const userType = readStoredUserRole();
    if (!userType || properties['user_type']) {
      return properties;
    }

    return { ...properties, user_type: userType };
  }
}
