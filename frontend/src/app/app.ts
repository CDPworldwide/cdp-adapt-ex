import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HazardMapService } from './features/hazard-map/hazard-map.service';
import { LanguageService } from './shared/services/language.service';
import { environment } from '../environments/environment';
import { FeedbackModalComponent } from './shared/feedback-modal/feedback-modal';
import { PosthogService } from './core/analytics/posthog.service';
import { GlobalSearchOverlayComponent } from './core/global-search/global-search-overlay.component';
import { GlobalSearchService } from './core/global-search/global-search.service';
import { WelcomeModalComponent } from './features/welcome-modal/welcome-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    FeedbackModalComponent,
    GlobalSearchOverlayComponent,
    WelcomeModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private languageService = inject(LanguageService);
  private hazardMapService = inject(HazardMapService);
  private posthogService = inject(PosthogService);
  private globalSearchService = inject(GlobalSearchService);
  protected readonly title = signal('frontend');

  skipToMain(event: Event) {
    event.preventDefault();
    const target = document.getElementById('page-content');
    target?.focus();
  }

  ngOnInit() {
    this.languageService.init();
    this.hazardMapService.preloadHazardLayers().subscribe();
    this.posthogService.init();
    this.initGoogleAnalytics();
  }

  private initGoogleAnalytics(): void {
    const measurementId = environment.googleAnalytics.measurementId;
    if (!environment.googleAnalytics.enabled || !measurementId) {
      return;
    }

    const windowWithGtag = window as typeof window & {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    windowWithGtag.dataLayer = windowWithGtag.dataLayer || [];
    windowWithGtag.gtag = (...args: unknown[]) => {
      windowWithGtag.dataLayer?.push(args);
    };
    windowWithGtag.gtag('js', new Date());
    windowWithGtag.gtag('config', measurementId, { debug_mode: environment.isDebugMode });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalSearchKeydown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) {
      return;
    }

    event.preventDefault();
    this.globalSearchService.open();
  }
}
