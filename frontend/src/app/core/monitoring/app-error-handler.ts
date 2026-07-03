import { ErrorHandler, Injectable, inject } from '@angular/core';

import { AnalyticsService } from '../analytics/analytics.service';
import { SentryService } from './sentry.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private posthog = inject(AnalyticsService);
  private sentry = inject(SentryService);

  handleError(error: unknown): void {
    this.sentry.captureException(error);
    this.posthog.captureException(error);
    console.error(error);
  }
}
