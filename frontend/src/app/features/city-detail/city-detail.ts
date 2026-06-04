import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
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
  private loadedOrganizationId: string | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private locationService: LocationService,
    private askCdpAiService: AskCdpAiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.data])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, data]) => {
        const organizationId = params.get('organizationId');
        this.organizationId = organizationId;
        this.activeTab = this.normalizeTab(params.get('tab'));
        this.isAiOpen = data['openAiPanel'] === true || this.isAiOpen;

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

    this.router.navigate(['/org', this.organizationId, tab]);
  }

  private loadLocationByOrganizationId(organizationId: string): void {
    this.isLoading = true;
    this.isNotFound = false;
    this.locationData = null;

    this.locationService
      .getLocationByOrganizationId(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.locationData = data;
          this.isLoading = false;
          this.prefetchStarterQuestions();
        },
        error: () => {
          this.isLoading = false;
          this.isNotFound = true;
        },
      });
  }

  private prefetchStarterQuestions(): void {
    if (!this.locationData) {
      return;
    }

    this.askCdpAiService.setLocationContext(this.locationData, this.activeTab);
    this.askCdpAiService
      .loadStarterQuestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  private normalizeTab(tab: string | null): LocationCardTabKey {
    if (tab && VALID_TABS.includes(tab as LocationCardTabKey)) {
      return tab as LocationCardTabKey;
    }

    return DEFAULT_TAB;
  }
}
