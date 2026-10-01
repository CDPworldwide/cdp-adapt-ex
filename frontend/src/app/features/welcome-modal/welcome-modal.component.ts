import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, OnInit, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FeedbackService } from '../../shared/services/feedback.service';
import { UserRoleId } from '../../core/analytics/user-role';
import { UserRoleService } from '../../core/analytics/user-role.service';
import { WelcomeModalService } from './welcome-modal.service';

export const WELCOME_MODAL_SKIPPED_STORAGE_KEY = 'cdp-welcome-modal-skipped';
const WELCOME_MODAL_SKIPPED_COOKIE = `${WELCOME_MODAL_SKIPPED_STORAGE_KEY}=true`;

@Component({
  selector: 'app-welcome-modal',
  templateUrl: './welcome-modal.component.html',
  imports: [CommonModule, TranslateModule],
})
export class WelcomeModalComponent implements OnInit {
  readonly feedbackService = inject(FeedbackService);
  readonly userRoleService = inject(UserRoleService);
  selectedRole: UserRoleId | null = null;

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly welcomeModalService = inject(WelcomeModalService);

  constructor() {
    effect(() => {
      if (this.welcomeModalService.isOpen()) {
        this.selectedRole = this.userRoleService.role();
      }
    });
  }

  get isOpen(): boolean {
    return this.welcomeModalService.isOpen();
  }

  ngOnInit(): void {
    if (this.shouldAutoOpen()) {
      this.welcomeModalService.open();
    }
  }

  selectRole(roleId: UserRoleId): void {
    this.selectedRole = roleId;
  }

  confirm(): void {
    if (!this.selectedRole) {
      return;
    }
    this.userRoleService.setRole(this.selectedRole, 'welcome_modal');
    this.close();
  }

  dismiss(): void {
    this.persistSkippedWelcomeModal();
    this.close();
  }

  private close(): void {
    this.welcomeModalService.close();
  }

  private shouldAutoOpen(): boolean {
    return (
      this.isHomepageRoute() &&
      !this.isMobileViewport() &&
      !this.userRoleService.role() &&
      !this.hasSkippedWelcomeModal()
    );
  }

  private isHomepageRoute(): boolean {
    const routerPath = this.router.url.split('?')[0].split('#')[0];
    const locationPath = this.document.location?.pathname || routerPath;

    return routerPath === '/' && locationPath === '/';
  }

  private isMobileViewport(): boolean {
    return this.document.defaultView?.matchMedia('(max-width: 767px)').matches === true;
  }

  private hasSkippedWelcomeModal(): boolean {
    try {
      if (localStorage.getItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY) === 'true') {
        return true;
      }
    } catch {
      // Fall back to cookies when local storage is blocked.
    }

    try {
      return this.document.cookie
        .split(';')
        .some((cookie) => cookie.trim() === WELCOME_MODAL_SKIPPED_COOKIE);
    } catch {
      return false;
    }
  }

  private persistSkippedWelcomeModal(): void {
    try {
      localStorage.setItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY, 'true');
    } catch {
      // Fall back to cookies when local storage is blocked.
    }

    try {
      this.document.cookie = `${WELCOME_MODAL_SKIPPED_COOKIE}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Storage is non-critical; keep the modal closed for this page load.
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.dismiss();
    }
  }
}
