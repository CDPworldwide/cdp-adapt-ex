import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { AnalyticsService } from '../../core/analytics/analytics.service';
import { FeedbackService } from '../../shared/services/feedback.service';
import {
  WELCOME_MODAL_SKIPPED_STORAGE_KEY,
  WelcomeModalComponent,
} from './welcome-modal.component';
import { WelcomeModalService } from './welcome-modal.service';

describe('WelcomeModalComponent', () => {
  let fixture: ComponentFixture<WelcomeModalComponent>;
  let component: WelcomeModalComponent;
  let posthog: jasmine.SpyObj<AnalyticsService>;
  let fetchSpy: jasmine.Spy;
  let welcomeModalService: WelcomeModalService;

  beforeEach(async () => {
    localStorage.clear();
    clearSkippedCookie();
    setPathname('/');
    ensureMatchMedia();
    spyOn(window, 'matchMedia').and.returnValue(createMediaQueryList(false));
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 204 }));
    posthog = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['capture', 'register']);

    await TestBed.configureTestingModule({
      imports: [WelcomeModalComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: FeedbackService, useValue: { open: jasmine.createSpy('open') } },
        { provide: AnalyticsService, useValue: posthog },
      ],
    }).compileComponents();

    welcomeModalService = TestBed.inject(WelcomeModalService);
  });

  afterEach(() => {
    localStorage.clear();
    clearSkippedCookie();
    setPathname('/');
  });

  it('opens when an older dismissed flag exists but no role has been stored', () => {
    localStorage.setItem('cdp-welcome-dismissed', 'true');
    createComponent();

    component.ngOnInit();

    expect(component.isOpen).toBeTrue();
  });

  it('stays closed on mobile even when no role has been stored', () => {
    (window.matchMedia as jasmine.Spy).and.returnValue(createMediaQueryList(true));
    createComponent();

    component.ngOnInit();

    expect(component.isOpen).toBeFalse();
  });

  it('stays closed when the first route load is not the homepage', () => {
    setPathname('/chat');
    createComponent();

    component.ngOnInit();

    expect(component.isOpen).toBeFalse();
  });

  it('stays closed when a role has already been stored', () => {
    localStorage.setItem('cdp-user-role', 'ngo');
    createComponent();

    component.ngOnInit();

    expect(component.isOpen).toBeFalse();
  });

  it('stays closed when the welcome modal has been skipped', () => {
    localStorage.setItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY, 'true');
    createComponent();

    component.ngOnInit();

    expect(component.isOpen).toBeFalse();
  });

  it('can be reopened from the header action after it has been skipped', () => {
    localStorage.setItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY, 'true');
    localStorage.setItem('cdp-user-role', 'business');
    createComponent();
    component.ngOnInit();

    welcomeModalService.open();
    fixture.detectChanges();

    expect(component.isOpen).toBeTrue();
    expect(component.selectedRole).toBe('business');
  });

  it('persists a skip when dismissed', () => {
    createComponent();
    component.ngOnInit();

    component.dismiss();

    expect(component.isOpen).toBeFalse();
    expect(localStorage.getItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY)).toBe('true');
    expect(localStorage.getItem('cdp-user-role')).toBeNull();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('persists a skip when dismissed with escape', () => {
    createComponent();
    component.ngOnInit();

    component.onEscape();

    expect(component.isOpen).toBeFalse();
    expect(localStorage.getItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY)).toBe('true');
  });

  it('tracks selected user type in PostHog when the role is confirmed', () => {
    createComponent();

    component.selectRole('governmentDiscloser');

    component.confirm();

    expect(localStorage.getItem('cdp-user-role')).toBe('governmentDiscloser');
    expect(localStorage.getItem(WELCOME_MODAL_SKIPPED_STORAGE_KEY)).toBeNull();
    expect(posthog.register).toHaveBeenCalledWith({ user_type: 'governmentDiscloser' });
    expect(posthog.capture).toHaveBeenCalledWith('user_role_selected', {
      user_type: 'governmentDiscloser',
      role: 'governmentDiscloser',
      previous_role: null,
      source: 'welcome_modal',
    });
    expect(fetchSpy).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/\/api\/v1\/onboarding\/role$/),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'governmentDiscloser' }),
      },
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(WelcomeModalComponent);
    component = fixture.componentInstance;
  }

  function clearSkippedCookie(): void {
    document.cookie = `${WELCOME_MODAL_SKIPPED_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }

  function ensureMatchMedia(): void {
    if ('matchMedia' in window) {
      return;
    }

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => createMediaQueryList(false),
    });
  }

  function createMediaQueryList(matches: boolean): MediaQueryList {
    return {
      matches,
      media: '(max-width: 767px)',
      onchange: null,
      addListener: jasmine.createSpy('addListener'),
      removeListener: jasmine.createSpy('removeListener'),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      dispatchEvent: jasmine.createSpy('dispatchEvent').and.returnValue(true),
    };
  }

  function setPathname(pathname: string): void {
    history.pushState({}, '', pathname);
  }
});
