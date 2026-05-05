import { Pipe, PipeTransform, inject, ChangeDetectorRef } from '@angular/core';
import { WebTranslationService } from '../services/web-translation.service';
import { LanguageService } from '../services/language.service';

@Pipe({
  name: 'autoTranslate',
  standalone: true,
  pure: false,
})
export class AutoTranslatePipe implements PipeTransform {
  private webTranslation = inject(WebTranslationService);
  private languageService = inject(LanguageService);
  private cdr = inject(ChangeDetectorRef);

  private currentValue = '';
  private lastInput = '';
  private lastLang = '';
  private lastSourceLang = '';

  transform(value: string | null | undefined, sourceLang = 'en'): string {
    if (!value) {
      return value ?? '';
    }

    const lang = this.languageService.currentLang();
    const normalizedSourceLang = sourceLang.trim().toLowerCase();

    if (lang === 'en' || lang === normalizedSourceLang || !this.webTranslation.isSupported) {
      return value;
    }

    if (
      value === this.lastInput &&
      lang === this.lastLang &&
      normalizedSourceLang === this.lastSourceLang
    ) {
      return this.currentValue;
    }

    this.lastInput = value;
    this.lastLang = lang;
    this.lastSourceLang = normalizedSourceLang;
    this.currentValue = value;

    const requestedLang = lang;
    const requestedSourceLang = normalizedSourceLang;
    this.webTranslation.translate(value, normalizedSourceLang).then((translated) => {
      if (
        value === this.lastInput &&
        requestedLang === this.languageService.currentLang() &&
        requestedSourceLang === this.lastSourceLang
      ) {
        this.currentValue = translated;
        this.cdr.markForCheck();
      }
    });

    return this.currentValue;
  }
}
