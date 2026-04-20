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

  transform(value: string | null | undefined): string {
    if (!value) {
      return value ?? '';
    }

    const lang = this.languageService.currentLang();

    if (lang === 'en' || !this.webTranslation.isSupported) {
      return value;
    }

    if (value === this.lastInput && lang === this.lastLang) {
      return this.currentValue;
    }

    this.lastInput = value;
    this.lastLang = lang;
    this.currentValue = value;

    const requestedLang = lang;
    this.webTranslation.translate(value).then((translated) => {
      if (value === this.lastInput && requestedLang === this.languageService.currentLang()) {
        this.currentValue = translated;
        this.cdr.markForCheck();
      }
    });

    return this.currentValue;
  }
}
