import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AutoTranslatePipe } from './auto-translate.pipe';
import { LanguageService } from '../services/language.service';
import { WebTranslationService } from '../services/web-translation.service';

@Component({
  standalone: true,
  imports: [AutoTranslatePipe],
  template: `<span>{{ text | autoTranslate: sourceLang }}</span>`,
})
class HostComponent {
  text = 'Children and youth';
  sourceLang: string | null | undefined = 'en';
}

describe('AutoTranslatePipe', () => {
  let fixture: ComponentFixture<HostComponent>;
  let languageService: { currentLang: jasmine.Spy<() => string> };
  let webTranslation: jasmine.SpyObj<WebTranslationService>;
  let resolveTranslation: (value: string) => void;

  beforeEach(async () => {
    languageService = {
      currentLang: jasmine.createSpy('currentLang').and.returnValue('es'),
    };
    webTranslation = jasmine.createSpyObj<WebTranslationService>(
      'WebTranslationService',
      ['translate'],
      { isSupported: true },
    );
    webTranslation.translate.and.returnValue(
      new Promise((resolve) => {
        resolveTranslation = resolve;
      }),
    );

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: LanguageService, useValue: languageService },
        { provide: WebTranslationService, useValue: webTranslation },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
  });

  it('keeps non-English output blank while a translation is pending', fakeAsync(() => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
    expect(webTranslation.translate).toHaveBeenCalledOnceWith('Children and youth', 'en');

    resolveTranslation('Ninos y jovenes');
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Ninos y jovenes');
  }));

  it('returns source text immediately when English is selected', () => {
    languageService.currentLang.and.returnValue('en');

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Children and youth');
    expect(webTranslation.translate).not.toHaveBeenCalled();
  });

  it('does not translate by default because profile text is translated by the backend', () => {
    fixture.componentInstance.sourceLang = undefined;

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Children and youth');
    expect(webTranslation.translate).not.toHaveBeenCalled();
  });
});
