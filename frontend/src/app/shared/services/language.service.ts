import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Language {
  code: string;
  label: string;
}

const STORAGE_KEY = 'preferredLanguage';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);

  readonly languages: Language[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español (Beta)' },
    { code: 'ja', label: '日本語 (Beta)' },
    { code: 'pt', label: 'Português (Beta)' },
    { code: 'zh', label: '中文 (Beta)' },
  ];

  readonly currentLang = signal('en');

  init(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    const lang = saved && this.languages.some((l) => l.code === saved) ? saved : 'en';
    this.translate.setDefaultLang('en');
    this.translate.use(lang);
    this.currentLang.set(lang);
    document.documentElement.lang = lang;
  }

  switchLanguage(code: string): void {
    if (!this.languages.some((l) => l.code === code)) {
      return;
    }
    this.translate.use(code);
    this.currentLang.set(code);
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  }
}
