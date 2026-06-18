import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { PosthogService } from '../../core/analytics/posthog.service';
import { FeedbackService } from '../../shared/services/feedback.service';
import { WelcomeModalComponent } from './welcome-modal.component';

describe('WelcomeModalComponent', () => {
  let fixture: ComponentFixture<WelcomeModalComponent>;
  let component: WelcomeModalComponent;
  let posthog: jasmine.SpyObj<PosthogService>;
  let fetchSpy: jasmine.Spy;

  beforeEach(async () => {
    localStorage.clear();
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 204 }));
    posthog = jasmine.createSpyObj<PosthogService>('PosthogService', ['capture', 'register']);

    await TestBed.configureTestingModule({
      imports: [WelcomeModalComponent, TranslateModule.forRoot()],
      providers: [
        { provide: FeedbackService, useValue: { open: jasmine.createSpy('open') } },
        { provide: PosthogService, useValue: posthog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('opens when an older dismissed flag exists but no role has been stored', () => {
    localStorage.setItem('cdp-welcome-dismissed', 'true');

    component.ngOnInit();

    expect(component.isOpen).toBeTrue();
  });

  it('stays closed when a role has already been stored', () => {
    localStorage.setItem('cdp-user-role', 'ngo');

    component.ngOnInit();

    expect(component.isOpen).toBeFalse();
  });

  it('tracks selected user type in PostHog when the role is confirmed', () => {
    component.selectRole('governmentDiscloser');

    component.confirm();

    expect(localStorage.getItem('cdp-user-role')).toBe('governmentDiscloser');
    expect(posthog.register).toHaveBeenCalledWith({ user_type: 'governmentDiscloser' });
    expect(posthog.capture).toHaveBeenCalledWith('user_role_selected', {
      user_type: 'governmentDiscloser',
      role: 'governmentDiscloser',
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/onboarding/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'governmentDiscloser' }),
    });
  });
});
