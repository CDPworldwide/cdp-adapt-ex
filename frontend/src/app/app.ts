import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HazardMapService } from './features/hazard-map/hazard-map.service';
import { LanguageService } from './shared/services/language.service';
import { environment } from '../environments/environment';
import { FeedbackModalComponent } from './shared/feedback-modal/feedback-modal';

declare let gtag: Function;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FeedbackModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private languageService = inject(LanguageService);
  private hazardMapService = inject(HazardMapService);
  protected readonly title = signal('frontend');

  skipToMain(event: Event) {
    event.preventDefault();
    const target = document.getElementById('page-content');
    target?.focus();
  }

  ngOnInit() {
    this.languageService.init();
    this.hazardMapService.preloadHazardLayers().subscribe();

    if (typeof gtag === 'function') {
      gtag('config', 'G-Z6QWJ09VM8', { debug_mode: environment.isDebugMode });
    }
  }
}
