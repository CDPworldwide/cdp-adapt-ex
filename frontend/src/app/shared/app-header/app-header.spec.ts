import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { WelcomeModalService } from '../../features/welcome-modal/welcome-modal.service';
import { AppHeaderComponent } from './app-header';

describe('AppHeaderComponent', () => {
  let fixture: ComponentFixture<AppHeaderComponent>;
  let welcomeModalService: jasmine.SpyObj<WelcomeModalService>;

  beforeEach(async () => {
    welcomeModalService = jasmine.createSpyObj<WelcomeModalService>('WelcomeModalService', [
      'open',
    ]);

    await TestBed.configureTestingModule({
      imports: [AppHeaderComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: WelcomeModalService, useValue: welcomeModalService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppHeaderComponent);
    fixture.detectChanges();
  });

  it('links the CDP logo to the app home page', () => {
    const logoLink: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a[aria-label="shared.home"]');

    expect(logoLink).not.toBeNull();
    expect(logoLink?.getAttribute('href')).toBe('/');
    expect(logoLink?.target).toBe('');
    expect(logoLink?.rel).toBe('');
  });

  it('opens the welcome modal from the help menu action', () => {
    fixture.componentInstance.openWelcomeModal();

    expect(welcomeModalService.open).toHaveBeenCalled();
  });

  it('links the AI header icon to the standalone chat page', () => {
    const chatLink: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a[routerlink="/chat"]');

    expect(chatLink).not.toBeNull();
    expect(chatLink?.getAttribute('aria-label')).toBe('askCdpAi.buttonText');
  });

  it('shows the language chooser in the header when chatMode is true', () => {
    fixture.componentInstance.chatMode = true;
    fixture.detectChanges();

    const languageButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[data-testid="language-selector"]',
    );

    expect(languageButton).not.toBeNull();
    expect(languageButton?.getAttribute('aria-label')).toBe('shared.selectLanguage');
  });
});
