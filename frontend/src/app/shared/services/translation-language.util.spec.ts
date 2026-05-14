import { normalizeTranslationLanguage } from './translation-language.util';

describe('normalizeTranslationLanguage', () => {
  it('normalizes supported codes and reporting-language labels', () => {
    expect(normalizeTranslationLanguage(' EN ')).toBe('en');
    expect(normalizeTranslationLanguage('Spanish')).toBe('es');
    expect(normalizeTranslationLanguage('Português (Beta)')).toBe('pt');
    expect(normalizeTranslationLanguage('zh-Hant')).toBe('zh');
  });

  it('normalizes regional locale tags to supported base languages', () => {
    expect(normalizeTranslationLanguage('en-US')).toBe('en');
    expect(normalizeTranslationLanguage('es_419')).toBe('es');
    expect(normalizeTranslationLanguage('pt-BR')).toBe('pt');
    expect(normalizeTranslationLanguage('ja-JP')).toBe('ja');
  });

  it('defaults blank values to English', () => {
    expect(normalizeTranslationLanguage(null)).toBe('en');
    expect(normalizeTranslationLanguage('   ')).toBe('en');
  });
});
