import { Injectable, inject } from '@angular/core';

import { GoogleAnalyticsService, type GoogleAnalyticsProperties } from './google-analytics.service';
import { PosthogService } from './posthog.service';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const GOOGLE_ANALYTICS_PROPERTY_ALLOWLIST: Record<string, readonly string[]> = {
  ai_chat_opened: ['context_area', 'country', 'user_type'],
  ai_chat_query_submitted: ['context_area', 'query_length', 'source', 'country', 'user_type'],
  feedback_opened: ['path', 'language', 'viewport', 'active_tab', 'user_type'],
  location_viewed: [
    'location_id',
    'country',
    'public_status',
    'disclosure_year',
    'hazards_count',
    'actions_count',
    'goals_count',
    'projects_count',
    'user_type',
  ],
  search_location_selected: ['country', 'org_type', 'source', 'rank', 'user_type'],
  user_role_selected: ['role', 'previous_role', 'source', 'user_type'],
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly googleAnalytics = inject(GoogleAnalyticsService);
  private readonly posthog = inject(PosthogService);

  init(): void {
    this.posthog.init();
    this.googleAnalytics.init();
  }

  capture(eventName: string, properties?: AnalyticsProperties): void {
    this.posthog.capture(eventName, properties);
    if (this.isGoogleAnalyticsEvent(eventName)) {
      this.googleAnalytics.capture(eventName, this.googleAnalyticsProperties(eventName, properties));
    }
  }

  register(properties: AnalyticsProperties): void {
    this.posthog.register(properties);
  }

  captureException(error: unknown): void {
    this.posthog.captureException(error);
  }

  private googleAnalyticsProperties(
    eventName: string,
    properties: AnalyticsProperties = {},
  ): GoogleAnalyticsProperties {
    const allowedProperties = GOOGLE_ANALYTICS_PROPERTY_ALLOWLIST[eventName] ?? [];

    return allowedProperties.reduce<GoogleAnalyticsProperties>((result, key) => {
      const value = properties[key];
      if (value == null || typeof value === 'object') {
        return result;
      }

      result[key] = typeof value === 'string' ? this.truncate(value) : value;
      return result;
    }, {});
  }

  private isGoogleAnalyticsEvent(eventName: string): boolean {
    return Object.prototype.hasOwnProperty.call(GOOGLE_ANALYTICS_PROPERTY_ALLOWLIST, eventName);
  }

  private truncate(value: string): string {
    return value.length > 100 ? value.slice(0, 100) : value;
  }
}
