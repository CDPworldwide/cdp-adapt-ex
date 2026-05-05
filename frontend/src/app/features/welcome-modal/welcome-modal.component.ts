import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

const STORAGE_KEY = 'cdp-welcome-dismissed';
const ROLE_STORAGE_KEY = 'cdp-user-role';

interface RoleOption {
  id: string;
  labelKey: string;
}

@Component({
  selector: 'app-welcome-modal',
  templateUrl: './welcome-modal.component.html',
  imports: [CommonModule, TranslateModule],
})
export class WelcomeModalComponent implements OnInit {
  isOpen = false;
  selectedRole: string | null = null;

  readonly roles: RoleOption[] = [
    { id: 'ngo', labelKey: 'homepage.welcomeModal.roles.ngo' },
    { id: 'governmentDiscloser', labelKey: 'homepage.welcomeModal.roles.governmentDiscloser' },
    { id: 'financial', labelKey: 'homepage.welcomeModal.roles.financial' },
    {
      id: 'governmentNotDisclosing',
      labelKey: 'homepage.welcomeModal.roles.governmentNotDisclosing',
    },
    { id: 'business', labelKey: 'homepage.welcomeModal.roles.business' },
    { id: 'other', labelKey: 'homepage.welcomeModal.roles.other' },
  ];

  ngOnInit(): void {
    this.isOpen = !this.readDismissedFlag();
  }

  selectRole(roleId: string): void {
    this.selectedRole = roleId;
  }

  confirm(): void {
    if (!this.selectedRole) {
      return;
    }
    this.persistRole(this.selectedRole);
    this.dismiss();
  }

  dismiss(): void {
    this.writeDismissedFlag();
    this.isOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.dismiss();
    }
  }

  private readDismissedFlag(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeDismissedFlag(): void {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // storage unavailable — modal still dismisses for the session.
    }
  }

  private persistRole(roleId: string): void {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, roleId);
    } catch {
      // storage unavailable — selection is non-critical metadata.
    }
  }
}
