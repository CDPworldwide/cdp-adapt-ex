import { Injectable, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { environment } from '@env/environment';
import { readStoredUserRole } from './user-role';

export type GoogleAnalyticsProperties = Record<string, string | number | boolean | undefined>;

type GtagFunction = (...args: unknown[]) => void;

const GOOGLE_ANALYTICS_EVENT_ALLOWLIST = new Set([
  'ai_chat_opened',
  'ai_chat_query_submitted',
  'feedback_opened',
  'location_viewed',
  'search_location_selected',
  'user_role_selected',
]);

@Injectable({ providedIn: 'root' })
export class GoogleAnalyticsService {
  private initialized = false;
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);

  init(): void {
    if (this.initialized || !this.isEnabled()) {
      return;
    }

    this.initialized = true;
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.capturePageView();
    });
  }

  capture(eventName: string, properties: GoogleAnalyticsProperties = {}): void {
    if (!this.initialized || !GOOGLE_ANALYTICS_EVENT_ALLOWLIST.has(eventName)) {
      return;
    }

    this.send('event', eventName, this.withUserType(properties));
  }

  private capturePageView(): void {
    this.send('event', 'page_view', {
      page_location: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      ...this.userTypeProperty(),
    });
  }

  private send(command: 'event', eventName: string, properties: GoogleAnalyticsProperties): void {
    const gtag = this.gtag();
    if (!gtag) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      gtag(command, eventName, properties);
    });
  }

  private gtag(): GtagFunction | undefined {
    const windowWithGtag = window as typeof window & { gtag?: GtagFunction };
    return typeof windowWithGtag.gtag === 'function' ? windowWithGtag.gtag : undefined;
  }

  private isEnabled(): boolean {
    return Boolean(
      this.gtag() || (environment.googleAnalytics.enabled && environment.googleAnalytics.measurementId),
    );
  }

  private withUserType(properties: GoogleAnalyticsProperties): GoogleAnalyticsProperties {
    return { ...properties, ...this.userTypeProperty(properties) };
  }

  private userTypeProperty(
    properties: GoogleAnalyticsProperties = {},
  ): GoogleAnalyticsProperties {
    const userType = readStoredUserRole();
    if (!userType || properties['user_type']) {
      return {};
    }

    return { user_type: userType };
  }
}
