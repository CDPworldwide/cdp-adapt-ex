import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FeedbackService } from '../../shared/services/feedback.service';
import { AnalyticsEvent } from '../../core/analytics/analytics-events';
import { PosthogService } from '../../core/analytics/posthog.service';
import { UserRoleId } from '../../core/analytics/user-role';
import { UserRoleService } from '../../core/analytics/user-role.service';

@Component({
  selector: 'app-welcome-modal',
  templateUrl: './welcome-modal.component.html',
  imports: [CommonModule, TranslateModule],
})
export class WelcomeModalComponent implements OnInit {
  readonly feedbackService = inject(FeedbackService);
  readonly posthog = inject(PosthogService);
  readonly userRoleService = inject(UserRoleService);
  isOpen = false;
  selectedRole: UserRoleId | null = null;

  ngOnInit(): void {
    this.isOpen = !this.userRoleService.role();
  }

  selectRole(roleId: UserRoleId): void {
    this.selectedRole = roleId;
  }

  confirm(): void {
    if (!this.selectedRole) {
      return;
    }
    this.userRoleService.setRole(this.selectedRole, 'welcome_modal');
    this.dismiss();
  }

  dismiss(): void {
    this.isOpen = false;
  }

  skip(): void {
    this.posthog.capture(AnalyticsEvent.WelcomeModalSkipped, {
      selected_role: this.selectedRole,
      had_selected_role: Boolean(this.selectedRole),
    });
    this.dismiss();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.dismiss();
    }
  }
}
