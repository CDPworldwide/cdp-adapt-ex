export const USER_ROLE_STORAGE_KEY = 'cdp-user-role';

export const USER_ROLE_OPTIONS = [
  { id: 'governmentDiscloser', labelKey: 'homepage.welcomeModal.roles.governmentDiscloser' },
  {
    id: 'governmentNotDisclosing',
    labelKey: 'homepage.welcomeModal.roles.governmentNotDisclosing',
  },
  { id: 'ngo', labelKey: 'homepage.welcomeModal.roles.ngo' },
  { id: 'financial', labelKey: 'homepage.welcomeModal.roles.financial' },
  { id: 'business', labelKey: 'homepage.welcomeModal.roles.business' },
  { id: 'other', labelKey: 'homepage.welcomeModal.roles.other' },
] as const;

export type UserRoleId = (typeof USER_ROLE_OPTIONS)[number]['id'];

export type UserRoleSource = 'welcome_modal' | 'header_settings';

export function isUserRoleId(value: string | null): value is UserRoleId {
  return USER_ROLE_OPTIONS.some((role) => role.id === value);
}

export function readStoredUserRole(): UserRoleId | null {
  try {
    const role = localStorage.getItem(USER_ROLE_STORAGE_KEY);
    return isUserRoleId(role) ? role : null;
  } catch {
    return null;
  }
}
