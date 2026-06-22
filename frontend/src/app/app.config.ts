import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { NavigationError, provideRouter, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { AppErrorHandler } from './core/monitoring/app-error-handler';

const CHUNK_LOAD_RELOAD_KEY = 'cdp:chunk-load-reload';

export function recoverFromChunkLoadError(
  error: NavigationError,
  reload: () => void = () => window.location.reload(),
): void {
  if (!isChunkLoadError(error.error)) {
    return;
  }

  const signature = `${error.url}:${getErrorMessage(error.error).slice(0, 200)}`;
  const previousSignature = readSessionValue(CHUNK_LOAD_RELOAD_KEY);
  if (previousSignature === signature) {
    return;
  }

  writeSessionValue(CHUNK_LOAD_RELOAD_KEY, signature);
  reload();
}

function isChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return [
    'Importing a module script failed',
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Loading chunk',
  ].some((text) => message.includes(text));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function readSessionValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the reload still gives the user a fresh asset graph.
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withNavigationErrorHandler(recoverFromChunkLoadError)),
    provideHttpClient(),
    provideTranslateService({
      fallbackLang: 'en',
    }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
    }),
  ],
};
