import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserRoleId } from '../../core/analytics/user-role';
import { UserRoleService } from '../../core/analytics/user-role.service';
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
    CdpLogoWithTextIconComponent,
  ],
  templateUrl: './app-header.html',
})
export class AppHeaderComponent {
  readonly languageService = inject(LanguageService);
  readonly feedbackService = inject(FeedbackService);
  readonly userRoleService = inject(UserRoleService);

  setRole(roleId: UserRoleId): void {
    this.userRoleService.setRole(roleId, 'header_settings');
  }
}
