import { ErrorHandler, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import posthog from 'posthog-js';
import { filter } from 'rxjs';

import { environment } from '@env/environment';

type PosthogEventProperties = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class PosthogService {
  private initialized = false;
  private router = inject(Router);

  init(): void {
    const config = environment.posthog;

    if (this.initialized || !config?.enabled || !config.key) {
      return;
    }

    posthog.init(config.key, {
      api_host: config.host,
      capture_pageview: false,
      capture_exceptions: true,
      autocapture: {
        url_allowlist: [
          /^https:\/\/cdp-action-explorer\.net(?:\/.*)?$/,
          /^https?:\/\/localhost:\d+(?:\/.*)?$/,
          /^https?:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/,
        ],
      },
      disable_session_recording: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*',
        blockSelector: '.sensitive-data, [data-ph-no-capture]',
      },
      debug: environment.isDebugMode,
    });

    this.initialized = true;
    this.capturePageView();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.capturePageView();
    });
  }

  capture(eventName: string, properties?: PosthogEventProperties): void {
    if (!this.initialized) {
      return;
    }

    posthog.capture(eventName, properties);
  }

  captureException(error: unknown): void {
    if (!this.initialized) {
      return;
    }

    posthog.captureException(error);
  }

  private capturePageView(): void {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path: window.location.pathname,
      search: window.location.search,
    });
  }
}

@Injectable()
export class PosthogErrorHandler implements ErrorHandler {
  private posthog = inject(PosthogService);

  handleError(error: unknown): void {
    this.posthog.captureException(error);
    console.error(error);
  }
}
