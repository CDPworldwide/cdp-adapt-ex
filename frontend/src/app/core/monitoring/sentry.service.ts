import { Injectable } from '@angular/core';

import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class SentryService {
  private sentryModule: Promise<typeof import('@sentry/angular')> | null = null;

  captureException(error: unknown): void {
    if (!this.isEnabled()) {
      return;
    }

    void this.getSentryModule().then((sentry) => sentry.captureException(error));
  }

  private isEnabled(): boolean {
    return Boolean(environment.sentry?.enabled && environment.sentry.dsn);
  }

  private getSentryModule(): Promise<typeof import('@sentry/angular')> {
    this.sentryModule ??= import('@sentry/angular');
    return this.sentryModule;
  }
}
