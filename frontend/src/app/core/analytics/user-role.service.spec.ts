import { TestBed } from '@angular/core/testing';

import { AnalyticsService } from './analytics.service';
import { UserRoleService } from './user-role.service';

describe('UserRoleService', () => {
  let posthog: jasmine.SpyObj<AnalyticsService>;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 204 }));
    posthog = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['capture', 'register']);

    TestBed.configureTestingModule({
      providers: [{ provide: AnalyticsService, useValue: posthog }],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('persists and reports a role selected from header settings', () => {
    const service = TestBed.inject(UserRoleService);

    service.setRole('business', 'header_settings');

    expect(service.role()).toBe('business');
    expect(localStorage.getItem('cdp-user-role')).toBe('business');
    expect(posthog.register).toHaveBeenCalledWith({ user_type: 'business' });
    expect(posthog.capture).toHaveBeenCalledWith('user_role_selected', {
      user_type: 'business',
      role: 'business',
      previous_role: null,
      source: 'header_settings',
    });
    expect(fetchSpy).toHaveBeenCalledOnceWith(jasmine.stringMatching(/\/api\/v1\/onboarding\/role$/), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'business' }),
    });
  });

  it('includes the previous role when the user changes roles', () => {
    const service = TestBed.inject(UserRoleService);

    service.setRole('governmentDiscloser', 'welcome_modal');
    service.setRole('ngo', 'header_settings');

    expect(posthog.capture).toHaveBeenCalledWith('user_role_selected', {
      user_type: 'ngo',
      role: 'ngo',
      previous_role: 'governmentDiscloser',
      source: 'header_settings',
    });
  });
});
