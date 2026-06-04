import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links terms of use to the current CDP terms and conditions page', () => {
    const termsLink: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('a[href="https://www.cdp.net/en/terms-and-conditions"]');

    expect(termsLink).not.toBeNull();
    expect(termsLink?.textContent?.trim()).toBe('locationCard.footer.termsOfUse');
  });
});
