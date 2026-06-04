import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LanguageService } from './language.service';

export interface FeedbackLocationContext {
  locationId?: string | number | null;
  locationName?: string | null;
  activeTab?: string | null;
}

const TYPEFORM_URL = 'https://cdp-worldwide.typeform.com/to/CFhsXgBm';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly languageService = inject(LanguageService);

  readonly isOpen = signal(false);
  private readonly openCount = signal(0);
  private readonly locationContext = signal<FeedbackLocationContext>({});

  readonly embedUrl = computed(() => {
    this.openCount();
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.buildTypeformUrl());
  });

  open(): void {
    this.openCount.update((count) => count + 1);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  setLocationContext(context: FeedbackLocationContext): void {
    this.locationContext.set(context);
  }

  clearLocationContext(): void {
    this.locationContext.set({});
  }

  private buildTypeformUrl(): string {
    const url = new URL(TYPEFORM_URL);
    const path = this.router.url.split('?')[0].split('#')[0] || '/';
    const context = path.startsWith('/org/') ? this.locationContext() : {};

    const hiddenFields: Record<string, string> = {
      page_url: this.currentPageUrl(),
      path,
      language: this.languageService.currentLang(),
      viewport: this.viewportSize(),
      timestamp_client: new Date().toISOString(),
      referrer: document.referrer || '',
      location_id: this.stringifyHiddenValue(context.locationId),
      location_name: this.stringifyHiddenValue(context.locationName),
      active_tab: this.stringifyHiddenValue(context.activeTab),
    };

    url.hash = new URLSearchParams(
      Object.entries(hiddenFields).filter(([, value]) => Boolean(value)),
    ).toString();

    return url.toString();
  }

  private currentPageUrl(): string {
    return window.location.href;
  }

  private viewportSize(): string {
    const width = window.innerWidth;
    if (width < 768) {
      return 'mobile';
    }
    if (width < 1024) {
      return 'tablet';
    }
    return 'desktop';
  }

  private stringifyHiddenValue(value: string | number | null | undefined): string {
    return value == null ? '' : String(value);
  }
}
