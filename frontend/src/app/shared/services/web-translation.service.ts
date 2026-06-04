import { Injectable, inject } from '@angular/core';
import { translateTextsApiV1TranslatePost } from '@pac-api/client';
import type { TranslateResponse } from '@pac-api/client';
import { createApiClient } from './api-client';
import { LanguageService } from './language.service';
import { normalizeTranslationLanguage } from './translation-language.util';

interface PendingEntry {
  resolvers: Array<(value: string) => void>;
  sourceLang: string;
  text: string;
  targetLang: string;
}

interface StoredTranslation {
  savedAt: number;
  text: string;
  value: string;
}

const CACHE_KEY_PREFIX = 'translation:v3:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_CACHE_ENTRIES = 500;
const BATCH_DELAY_MS = 50;
const MAX_BATCH_SIZE = 50;
const REQUEST_RETRY_COUNT = 1;
const REQUEST_RETRY_DELAY_MS = 150;

@Injectable({ providedIn: 'root' })
export class WebTranslationService {
  private languageService = inject(LanguageService);
  private client = createApiClient();
  private translationCache = new Map<string, string>();
  private pendingBatch = new Map<string, PendingEntry>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  get isSupported(): boolean {
    return true;
  }

  async translate(text: string, sourceLang: string | null | undefined = 'en'): Promise<string> {
    const targetLang = normalizeTranslationLanguage(this.languageService.currentLang());
    const normalizedSourceLang = normalizeTranslationLanguage(sourceLang);

    if (!text || targetLang === 'en' || normalizedSourceLang === targetLang) {
      return text;
    }

    const cacheKey = this.buildCacheKey(normalizedSourceLang, targetLang, text);

    const cached = this.translationCache.get(cacheKey) ?? this.loadFromStorage(cacheKey, text);
    if (cached !== null) {
      return cached;
    }

    return new Promise<string>((resolve) => {
      const existing = this.pendingBatch.get(cacheKey);
      if (existing) {
        existing.resolvers.push(resolve);
      } else {
        this.pendingBatch.set(cacheKey, {
          resolvers: [resolve],
          sourceLang: normalizedSourceLang,
          text,
          targetLang,
        });
      }
      this.scheduleBatchFlush();

      if (this.pendingBatch.size >= MAX_BATCH_SIZE) {
        this.flushAllBatches();
      }
    });
  }

  clearCache(): void {
    this.translationCache.clear();

    this.clearStorageBucket(localStorage);
    this.clearStorageBucket(sessionStorage);
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer !== null) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushAllBatches();
    }, BATCH_DELAY_MS);
  }

  private flushAllBatches(): void {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = new Map(this.pendingBatch);
    this.pendingBatch.clear();

    if (batch.size === 0) {
      return;
    }

    // Group by target language
    const byLang = new Map<string, Array<[string, PendingEntry]>>();
    for (const [cacheKey, entry] of batch) {
      const batchKey = `${entry.sourceLang}:${entry.targetLang}`;
      const group = byLang.get(batchKey) ?? [];
      group.push([cacheKey, entry]);
      byLang.set(batchKey, group);
    }

    for (const [langPair, entries] of byLang) {
      const [sourceLang, targetLang] = langPair.split(':');
      // Chunk into groups of MAX_BATCH_SIZE
      for (let i = 0; i < entries.length; i += MAX_BATCH_SIZE) {
        const chunk = entries.slice(i, i + MAX_BATCH_SIZE);
        this.flushChunk(sourceLang, targetLang, chunk);
      }
    }
  }

  private async flushChunk(
    sourceLang: string,
    targetLang: string,
    entries: Array<[string, PendingEntry]>,
  ): Promise<void> {
    const texts = entries.map(([, { text }]) => text);

    try {
      const response = await this.requestTranslations(texts, sourceLang, targetLang);
      entries.forEach(([cacheKey, { resolvers }], index) => {
        const translated = response.translations[index];
        if (translated === undefined) {
          resolvers.forEach((resolve) => resolve(texts[index]));
          return;
        }
        this.storeInCache(cacheKey, translated, texts[index]);
        resolvers.forEach((resolve) => resolve(translated));
      });
    } catch {
      entries.forEach(([, { resolvers, text }]) => {
        resolvers.forEach((resolve) => resolve(text));
      });
    }
  }

  private async requestTranslations(
    texts: string[],
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslateResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= REQUEST_RETRY_COUNT; attempt++) {
      try {
        const result = await translateTextsApiV1TranslatePost({
          client: this.client,
          body: {
            texts,
            target_language: targetLang,
            source_language: sourceLang,
          },
        });

        if (result.error) {
          throw result.error;
        }

        return result.data as TranslateResponse;
      } catch (error) {
        lastError = error;
        if (attempt < REQUEST_RETRY_COUNT) {
          await new Promise((resolve) => setTimeout(resolve, REQUEST_RETRY_DELAY_MS));
        }
      }
    }

    throw lastError;
  }

  private storeInCache(key: string, value: string, text: string): void {
    this.translationCache.set(key, value);

    if (this.translationCache.size > MAX_CACHE_ENTRIES) {
      const firstKey = this.translationCache.keys().next().value;
      if (firstKey) {
        this.translationCache.delete(firstKey);
      }
    }

    try {
      const payload: StoredTranslation = { text, value, savedAt: Date.now() };
      localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(payload));
      this.pruneStorage(localStorage);
    } catch {
      try {
        const payload: StoredTranslation = { text, value, savedAt: Date.now() };
        sessionStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(payload));
        this.pruneStorage(sessionStorage);
      } catch {
        // Storage full or unavailable — ignore
      }
    }
  }

  private loadFromStorage(key: string, text: string): string | null {
    return (
      this.loadFromStorageBucket(localStorage, key, text) ??
      this.loadFromStorageBucket(sessionStorage, key, text)
    );
  }

  private clearStorageBucket(storage: Storage): void {
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          storage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private loadFromStorageBucket(storage: Storage, key: string, text: string): string | null {
    const storageKey = CACHE_KEY_PREFIX + key;

    try {
      const rawValue = storage.getItem(storageKey);
      if (rawValue === null) {
        return null;
      }

      const parsed = JSON.parse(rawValue) as StoredTranslation;
      if (
        parsed.text !== text ||
        typeof parsed.value !== 'string' ||
        Date.now() - parsed.savedAt > CACHE_TTL_MS
      ) {
        storage.removeItem(storageKey);
        return null;
      }

      this.translationCache.set(key, parsed.value);
      return parsed.value;
    } catch {
      return null;
    }
  }

  private pruneStorage(storage: Storage): void {
    const cacheEntries: Array<{ key: string; savedAt: number }> = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(CACHE_KEY_PREFIX)) {
        continue;
      }

      try {
        const parsed = JSON.parse(storage.getItem(key) ?? '{}') as Partial<StoredTranslation>;
        cacheEntries.push({ key, savedAt: parsed.savedAt ?? 0 });
      } catch {
        cacheEntries.push({ key, savedAt: 0 });
      }
    }

    if (cacheEntries.length <= MAX_CACHE_ENTRIES) {
      return;
    }

    cacheEntries.sort((a, b) => a.savedAt - b.savedAt);
    cacheEntries
      .slice(0, cacheEntries.length - MAX_CACHE_ENTRIES)
      .forEach(({ key }) => storage.removeItem(key));
  }

  private buildCacheKey(sourceLang: string, targetLang: string, text: string): string {
    return `${sourceLang}:${targetLang}:${this.hashText(text)}`;
  }

  private hashText(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${(hash >>> 0).toString(36)}:${text.length}`;
  }
}
