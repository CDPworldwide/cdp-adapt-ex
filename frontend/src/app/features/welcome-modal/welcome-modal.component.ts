import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FeedbackService } from '../../shared/services/feedback.service';
import { UserRoleId } from '../../core/analytics/user-role';
import { UserRoleService } from '../../core/analytics/user-role.service';

@Component({
  selector: 'app-welcome-modal',
  templateUrl: './welcome-modal.component.html',
  imports: [CommonModule, TranslateModule],
})
export class WelcomeModalComponent implements OnInit {
  readonly feedbackService = inject(FeedbackService);
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.dismiss();
    }
  }
}
