import { Injectable, inject } from '@angular/core';
import { translateTextsApiV1TranslatePost } from '@pac-api/client';
import type { TranslateResponse } from '@pac-api/client';
import { createApiClient } from './api-client';
import { LanguageService } from './language.service';

interface PendingEntry {
  resolvers: Array<(value: string) => void>;
  sourceLang: string;
  text: string;
  targetLang: string;
}

const CACHE_KEY_PREFIX = 'translation:';
const MAX_CACHE_ENTRIES = 500;
const BATCH_DELAY_MS = 50;
const MAX_BATCH_SIZE = 50;

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

  async translate(text: string, sourceLang = 'en'): Promise<string> {
    const targetLang = this.languageService.currentLang();

    if (!text || targetLang === 'en' || sourceLang === targetLang) {
      return text;
    }

    const normalizedSourceLang = sourceLang.trim().toLowerCase();
    const cacheKey = `${normalizedSourceLang}:${targetLang}:${text}`;

    const cached = this.translationCache.get(cacheKey) ?? this.loadFromStorage(cacheKey);
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

    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage errors
    }
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

      const response = result.data as TranslateResponse;
      entries.forEach(([cacheKey, { resolvers }], index) => {
        const translated = response.translations[index] ?? texts[index];
        this.storeInCache(cacheKey, translated);
        resolvers.forEach((resolve) => resolve(translated));
      });
    } catch {
      entries.forEach(([, { resolvers, text }]) => {
        resolvers.forEach((resolve) => resolve(text));
      });
    }
  }

  private storeInCache(key: string, value: string): void {
    this.translationCache.set(key, value);

    if (this.translationCache.size > MAX_CACHE_ENTRIES) {
      const firstKey = this.translationCache.keys().next().value;
      if (firstKey) {
        this.translationCache.delete(firstKey);
      }
    }

    try {
      sessionStorage.setItem(CACHE_KEY_PREFIX + key, value);
    } catch {
      // Storage full — ignore
    }
  }

  private loadFromStorage(key: string): string | null {
    try {
      const value = sessionStorage.getItem(CACHE_KEY_PREFIX + key);
      if (value !== null) {
        this.translationCache.set(key, value);
      }
      return value;
    } catch {
      return null;
    }
  }
}
