import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

async function initSentry(): Promise<void> {
  if (!environment.sentry?.enabled || !environment.sentry.dsn) {
    return;
  }

  const Sentry = await import('@sentry/angular');

  Sentry.init({
    dsn: environment.sentry.dsn,
    environment: environment.sentry.environment,
    release: environment.sentry.release || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: environment.sentry.tracesSampleRate,
    tracePropagationTargets: [
      /^https:\/\/cdp-action-explorer\.net(?:\/.*)?$/,
      /^https?:\/\/localhost:\d+(?:\/.*)?$/,
      /^https?:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/,
    ],
  });
}

void initSentry()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
