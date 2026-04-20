import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { createClient, createConfig } from '@pac-api/client/client';
import { translateTextsApiV1TranslatePost } from '@pac-api/client';
import type { TranslateResponse } from '@pac-api/client';
import { LanguageService } from './language.service';

interface PendingEntry {
  resolvers: Array<(value: string) => void>;
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
  private client = createClient(
    createConfig({
      baseUrl: environment.baseUrl,
    }),
  );
  private translationCache = new Map<string, string>();
  private pendingBatch = new Map<string, PendingEntry>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;

  get isSupported(): boolean {
    return true;
  }

  async translate(text: string): Promise<string> {
    const targetLang = this.languageService.currentLang();

    if (!text || targetLang === 'en') {
      return text;
    }

    const cacheKey = `${targetLang}:${text}`;

    const cached = this.translationCache.get(cacheKey) ?? this.loadFromStorage(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return new Promise<string>((resolve) => {
      const existing = this.pendingBatch.get(cacheKey);
      if (existing) {
        existing.resolvers.push(resolve);
      } else {
        this.pendingBatch.set(cacheKey, { resolvers: [resolve], text, targetLang });
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
      const group = byLang.get(entry.targetLang) ?? [];
      group.push([cacheKey, entry]);
      byLang.set(entry.targetLang, group);
    }

    for (const [targetLang, entries] of byLang) {
      // Chunk into groups of MAX_BATCH_SIZE
      for (let i = 0; i < entries.length; i += MAX_BATCH_SIZE) {
        const chunk = entries.slice(i, i + MAX_BATCH_SIZE);
        this.flushChunk(targetLang, chunk);
      }
    }
  }

  private async flushChunk(
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
          source_language: 'en',
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
