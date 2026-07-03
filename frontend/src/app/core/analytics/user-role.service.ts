import { Injectable, inject, signal } from '@angular/core';
import { environment } from '@env/environment';

import { AnalyticsService } from './analytics.service';
import {
  USER_ROLE_OPTIONS,
  USER_ROLE_STORAGE_KEY,
  UserRoleId,
  UserRoleSource,
  readStoredUserRole,
} from './user-role';

@Injectable({ providedIn: 'root' })
export class UserRoleService {
  private readonly posthog = inject(AnalyticsService);
  private readonly selectedRole = signal<UserRoleId | null>(readStoredUserRole());

  readonly roles = USER_ROLE_OPTIONS;
  readonly role = this.selectedRole.asReadonly();

  setRole(roleId: UserRoleId, source: UserRoleSource): void {
    const previousRole = this.selectedRole();

    this.persistRole(roleId);
    this.selectedRole.set(roleId);
    this.reportRole(roleId, source, previousRole);
  }

  private persistRole(roleId: UserRoleId): void {
    try {
      localStorage.setItem(USER_ROLE_STORAGE_KEY, roleId);
    } catch {
      // Storage is non-critical; keep the in-memory role for this page load.
    }
  }

  private reportRole(
    roleId: UserRoleId,
    source: UserRoleSource,
    previousRole: UserRoleId | null,
  ): void {
    this.posthog.register({ user_type: roleId });
    this.posthog.capture('user_role_selected', {
      user_type: roleId,
      role: roleId,
      previous_role: previousRole,
      source,
    });

    // Fire-and-forget: never block the UI on the network.
    void fetch(`${environment.baseUrl}/api/v1/onboarding/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleId }),
    }).catch(() => {
      // Telemetry only; ignore failures.
    });
  }
}
