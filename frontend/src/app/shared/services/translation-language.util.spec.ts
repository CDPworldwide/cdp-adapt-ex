import { normalizeTranslationLanguage } from './translation-language.util';

describe('normalizeTranslationLanguage', () => {
  it('normalizes supported codes and reporting-language labels', () => {
    expect(normalizeTranslationLanguage(' EN ')).toBe('en');
    expect(normalizeTranslationLanguage('Spanish')).toBe('es');
    expect(normalizeTranslationLanguage('Português (Beta)')).toBe('pt');
    expect(normalizeTranslationLanguage('zh-Hant')).toBe('zh');
  });

  it('defaults blank values to English', () => {
    expect(normalizeTranslationLanguage(null)).toBe('en');
    expect(normalizeTranslationLanguage('   ')).toBe('en');
  });
});
