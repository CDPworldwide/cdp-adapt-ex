import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { AskCdpAiComponent } from '../ask-cdp-ai/ask-cdp-ai.component';
import {
  LocationCardComponent,
  type LocationCardTabKey,
  type LocationData,
} from '../location-card/location-card';
import { LocationService } from '../../shared/services/location.service';
import { TranslateModule } from '@ngx-translate/core';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import { AskCdpAiLogoIconComponent } from '../../shared/icons/ask-cdp-ai-logo-icon.component';
import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { LanguageService } from '../../shared/services/language.service';
import { FeedbackService } from '../../shared/services/feedback.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';

const DEFAULT_TAB: LocationCardTabKey = 'hazards';
const VALID_TABS: readonly LocationCardTabKey[] = ['hazards', 'actions', 'solutions'];

@Component({
  selector: 'app-city-detail',
  imports: [
    CommonModule,
    TranslateModule,
    AppHeaderComponent,
    AskCdpAiComponent,
    LocationCardComponent,
    AskCdpAiLogoIconComponent,
  ],
  templateUrl: './city-detail.html',
  styleUrl: './city-detail.css',
  host: { class: 'flex flex-col flex-1 min-h-0' },
})
export class CityDetailPageComponent implements OnInit {
  locationData: LocationData | null = null;
  isLoading = true;
  isNotFound = false;
  organizationId: string | null = null;
  activeTab: LocationCardTabKey = DEFAULT_TAB;
  isAiOpen = false;
  selectedActionHazardFilter: string | null = null;
  private loadedOrganizationId: string | null = null;
  private loadedLanguage: string | null = null;
  private locationLoadRequestId = 0;

  private destroyRef = inject(DestroyRef);
  private languageService = inject(LanguageService);
  private feedbackService = inject(FeedbackService);
  private mobileKeyboardViewportService = inject(MobileKeyboardViewportService);

  constructor(
    private locationService: LocationService,
    private askCdpAiService: AskCdpAiService,
    private route: ActivatedRoute,
    private router: Router,
    private browserLocation: Location,
  ) {
    effect(() => {
      const lang = this.languageService.currentLang();
      if (!this.loadedOrganizationId || this.loadedLanguage === lang) {
        return;
      }

      this.loadLocationByOrganizationId(this.loadedOrganizationId);
    });
  }

  ngOnInit(): void {
    this.mobileKeyboardViewportService.startTracking(this.destroyRef);

    combineLatest([this.route.paramMap, this.route.queryParamMap, this.route.data])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams, data]) => {
        const organizationId = params.get('organizationId');
        this.organizationId = organizationId;
        this.activeTab = this.normalizeTab(params.get('tab'));
        this.isAiOpen = data['openAiPanel'] === true || queryParams.has('chatopen');

        if (!organizationId) {
          this.isLoading = false;
          this.isNotFound = true;
          return;
        }

        if (this.loadedOrganizationId !== organizationId) {
          this.loadedOrganizationId = organizationId;
          this.loadLocationByOrganizationId(organizationId);
          return;
        }

        this.prefetchStarterQuestions();
      });
  }

  onBackHome(): void {
    this.router.navigate(['/']);
  }

  onTabChange(tab: LocationCardTabKey): void {
    if (!this.organizationId || tab === this.activeTab) {
      return;
    }

    if (this.isAiOpen) {
      this.navigateToChatOpenUrl(this.buildChatOpenUrl(`/org/${this.organizationId}/${tab}`));
      return;
    }

    this.router.navigate(['/org', this.organizationId, tab]);
  }

  openAiPanel(): void {
    this.isAiOpen = true;
    this.navigateToChatOpenUrl(this.buildChatOpenUrl());
  }

  onAiOpenChange(isOpen: boolean): void {
    this.isAiOpen = isOpen;

    if (!isOpen) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { chatopen: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  private buildChatOpenUrl(path = this.router.url.split('?')[0].split('#')[0]): string {
    const [_currentPath, fragment = ''] = this.router.url.split('#');
    const queryString = this.router.url.split('#')[0].split('?')[1] || '';
    const queryParams = queryString
      .split('&')
      .filter(Boolean)
      .filter((param) => decodeURIComponent(param.split('=')[0]) !== 'chatopen');

    queryParams.push('chatopen');

    return `${path}?${queryParams.join('&')}${fragment ? `#${fragment}` : ''}`;
  }

  private navigateToChatOpenUrl(url: string): void {
    void this.router.navigateByUrl(url).then((navigated) => {
      if (navigated) {
        this.browserLocation.replaceState(url);
      }
    });
  }

  private loadLocationByOrganizationId(organizationId: string): void {
    const requestedLanguage = this.languageService.currentLang();
    const requestId = ++this.locationLoadRequestId;
    this.isLoading = true;
    this.isNotFound = false;
    this.locationData = null;
    this.loadedLanguage = requestedLanguage;

    this.locationService
      .getLocationByOrganizationId(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (!this.isCurrentLocationRequest(organizationId, requestedLanguage, requestId)) {
            return;
          }
          this.locationData = data;
          this.updateFeedbackContext();
          this.isLoading = false;
          this.prefetchStarterQuestions();
        },
        error: () => {
          if (!this.isCurrentLocationRequest(organizationId, requestedLanguage, requestId)) {
            return;
          }
          this.isLoading = false;
          this.isNotFound = true;
        },
      });
  }

  private isCurrentLocationRequest(
    organizationId: string,
    language: string,
    requestId: number,
  ): boolean {
    return (
      requestId === this.locationLoadRequestId &&
      organizationId === this.loadedOrganizationId &&
      language === this.loadedLanguage
    );
  }

  private prefetchStarterQuestions(): void {
    if (!this.locationData) {
      return;
    }

    this.updateFeedbackContext();
    this.updateAiLocationContext();
    this.askCdpAiService
      .loadStarterQuestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  onActionHazardFilterChange(filter: string | null): void {
    this.selectedActionHazardFilter = filter;
    this.updateAiLocationContext();
  }

  private updateAiLocationContext(): void {
    if (!this.locationData) {
      return;
    }

    this.askCdpAiService.setLocationContext(
      this.locationData,
      this.activeTab,
      this.activeTab === 'actions' ? this.selectedActionHazardFilter : null,
    );
  }

  private normalizeTab(tab: string | null): LocationCardTabKey {
    if (tab && VALID_TABS.includes(tab as LocationCardTabKey)) {
      return tab as LocationCardTabKey;
    }

    return DEFAULT_TAB;
  }

  private updateFeedbackContext(): void {
    this.feedbackService.setLocationContext({
      locationId: this.organizationId,
      locationName: this.locationData?.name,
      activeTab: this.activeTab,
    });
  }
}
