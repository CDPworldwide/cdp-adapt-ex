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

declare let gtag: Function;

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

    if (typeof gtag === 'function') {
      gtag('config', 'G-Z6QWJ09VM8', { debug_mode: environment.isDebugMode });
    }
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
