const LANGUAGE_ALIASES: Record<string, string> = {
  chinese: 'zh',
  'chinese simplified': 'zh',
  'chinese traditional': 'zh',
  en: 'en',
  eng: 'en',
  english: 'en',
  es: 'es',
  espanol: 'es',
  español: 'es',
  ja: 'ja',
  japanese: 'ja',
  jp: 'ja',
  mandarin: 'zh',
  portuguese: 'pt',
  portugues: 'pt',
  português: 'pt',
  pt: 'pt',
  spanish: 'es',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-tw': 'zh',
};

export function normalizeTranslationLanguage(value: string | null | undefined): string {
  const normalized = (value || 'en')
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[_-]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return 'en';
  }

  return LANGUAGE_ALIASES[normalized] ?? normalized;
}
