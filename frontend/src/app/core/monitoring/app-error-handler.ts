import { ErrorHandler, Injectable, inject } from '@angular/core';

import { PosthogService } from '../analytics/posthog.service';
import { SentryService } from './sentry.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private posthog = inject(PosthogService);
  private sentry = inject(SentryService);

  handleError(error: unknown): void {
    this.sentry.captureException(error);
    this.posthog.captureException(error);
    console.error(error);
  }
}
