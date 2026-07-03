import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { GlobalSearchService } from '../../core/global-search/global-search.service';
import { WelcomeModalService } from '../../features/welcome-modal/welcome-modal.service';
import { AskCdpAiLogoIconComponent } from '../icons/ask-cdp-ai-logo-icon.component';
import { CdpLogoWithTextIconComponent } from '../icons';
import { FeedbackService } from '../services/feedback.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    TranslateModule,
    AskCdpAiLogoIconComponent,
    CdpLogoWithTextIconComponent,
  ],
  templateUrl: './app-header.html',
})
export class AppHeaderComponent implements OnInit {
  @Input() chatMode = false;

  readonly languageService = inject(LanguageService);
  readonly feedbackService = inject(FeedbackService);
  readonly isOrgPage = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly globalSearchService = inject(GlobalSearchService);
  private readonly welcomeModalService = inject(WelcomeModalService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.updateIsOrgPage(this.router.url ?? '');

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.updateIsOrgPage(event.urlAfterRedirects));
  }

  openGlobalSearch(): void {
    this.globalSearchService.open();
  }

  openWelcomeModal(): void {
    this.welcomeModalService.open();
  }

  closeChatMode(): void {
    const url = this.router.url ?? '';
    const [pathAndQuery, fragment = ''] = url.split('#');
    const [path, queryString = ''] = pathAndQuery.split('?');
    const queryParams = queryString
      .split('&')
      .filter(Boolean)
      .filter((param) => decodeURIComponent(param.split('=')[0]) !== 'chatopen');
    const nextQuery = queryParams.length ? `?${queryParams.join('&')}` : '';

    this.router.navigateByUrl(`${path}${nextQuery}${fragment ? `#${fragment}` : ''}`);
  }

  private updateIsOrgPage(url: string): void {
    this.isOrgPage.set(url.startsWith('/org/'));
  }
}
