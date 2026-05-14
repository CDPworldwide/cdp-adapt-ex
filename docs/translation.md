# Translation System

The application supports multilingual content through two complementary systems:

1. **Static translations** (ngx-translate) for UI strings like labels, headings, and button text
2. **Dynamic translations** (Google Cloud Translate API) for data-driven content like hazard descriptions, adaptation actions, and solution names

## Supported Languages

| Code | Language   |
|------|------------|
| en   | English    |
| es   | Español    |
| ja   | 日本語     |
| pt   | Português  |
| zh   | 中文       |

Configured in `backend/app/shared/config.py` via `SUPPORTED_TRANSLATION_LANGUAGES` (default: `en,es,ja,pt,zh`). The frontend mirrors this list in `frontend/src/app/shared/services/language.service.ts`.

## Architecture Overview

```
User selects language (app-header)
  │
  ├─ LanguageService.switchLanguage(code)
  │   ├─ ngx-translate loads /assets/i18n/{code}.json
  │   ├─ currentLang signal updated
  │   └─ Preference saved to localStorage
  │
  ├─ Static content: {{ 'key' | translate }}
  │   └─ Resolved from i18n JSON files
  │
  └─ Dynamic content: {{ value | autoTranslate }}
      └─ WebTranslationService.translate(text)
          ├─ Check in-memory cache / sessionStorage
          ├─ Queue into pending batch
          ├─ Flush after 50ms (or when batch hits 50 items)
          ├─ POST /api/v1/translate → Google Cloud Translate v3
          ├─ Cache result (memory + sessionStorage)
          └─ Trigger change detection to update view
```

## Static Translations (ngx-translate)

### How it works

The `@ngx-translate/core` library loads JSON files from `frontend/src/assets/i18n/` at runtime. When the language changes, it swaps the active translation file.

### Configuration

Configured in `frontend/src/app/app.config.ts`:

```typescript
provideTranslateService({ fallbackLang: 'en' })
provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' })
```

### i18n files

Located at `frontend/src/assets/i18n/{lang}.json`. Keys use dot-separated namespaces:

```json
{
  "locationCard": {
    "hazardNames": {
      "DROUGHT": "Drought",
      "FLOOD": "Flood"
    },
    "govActions": {
      "all": "All",
      "actionsSummary": "Actions Summary"
    }
  }
}
```

### Usage in templates

```html
{{ 'locationCard.hazardNames.DROUGHT' | translate }}
{{ 'locationCard.hazardNames.' + hazard.hazardType | translate }}
```

### Adding new static translations

1. Add the English key to `frontend/src/assets/i18n/en.json`
2. Add the corresponding translation to each language file (`es.json`, `ja.json`, `pt.json`, `zh.json`)

## Dynamic Translations (Google Cloud Translate)

Dynamic translation is used for content that comes from the database or API responses — text that can't be known ahead of time.

### Backend

#### API endpoint

`POST /api/v1/translate` — rate-limited to 60 requests/minute.

**Request:**
```json
{
  "texts": ["Hello world", "Climate hazard assessment"],
  "target_language": "es",
  "source_language": "en"
}
```

**Response:**
```json
{
  "translations": ["Hola mundo", "Evaluación de riesgos climáticos"],
  "source_language": "en",
  "target_language": "es"
}
```

Constraints:
- `texts`: 1–50 items per request
- `target_language`: must be in `SUPPORTED_TRANSLATION_LANGUAGES`
- If source and target match, returns texts unchanged (no API call)

#### Key files

| File | Purpose |
|------|---------|
| `backend/app/api/v1/translate.py` | Route handler |
| `backend/app/api/v1/deps.py` | `get_translate_client` dependency |
| `backend/app/services/clients/translate_client.py` | Google Cloud Translate v3 wrapper |
| `backend/app/services/clients/translation_text_processor.py` | Acronym protection/restoration/validation helpers |
| `backend/app/schemas/translate.py` | Pydantic request/response models |

#### Google Cloud Translate client

The `TranslateClient` class wraps Google Cloud Translate v3. It uses thread-safe lazy initialization and runs via `run_in_threadpool` in the async route handler to avoid blocking the event loop.

Requires `PROJECT_ID` to be set. If not configured, translations are skipped and original text is returned.

Before sending text to Google Cloud Translate, the client replaces acronyms with stable placeholders and restores the original tokens after translation. This protects all-caps and dotted acronyms such as `MOSE`, `M.O.S.E.`, `EPA`, and `HVAC/CDP` from being expanded, localized, or otherwise corrupted.

After restoration, the client validates that protected tokens were restored exactly once and were not mutated into close variants. If validation fails, it logs `translation_acronym_validation_failed` with counts and returns the original text for that item.

BigQuery processed tables remain the source data and audit surface for stored English-normalized content. The frontend/runtime fix does not rely on BigQuery-side placeholder wrapping around `ML.TRANSLATE`.

### Frontend

#### WebTranslationService

`frontend/src/app/shared/services/web-translation.service.ts`

Handles batching, caching, and API calls using the auto-generated TypeScript SDK client (`translateTextsApiV1TranslatePost` from `@pac-api/client`).

**Batching:**
- Translation requests are queued into a pending batch
- After 50ms (or when 50 items accumulate), the batch is flushed
- Requests are grouped by source/target language pair and chunked into groups of 50

**Caching (two-tier):**
- In-memory `Map` (max 500 entries, LRU eviction)
- `sessionStorage` (persists across page navigations within the session)
- Cache storage prefix: `translation:v2:`
- Cache key format after the prefix: `{sourceLang}:{targetLang}:{text}`

**Error handling:** returns original text on failure.

#### AutoTranslatePipe

`frontend/src/app/shared/pipes/auto-translate.pipe.ts`

An impure Angular pipe that triggers async translation and updates the view when the result arrives.

```html
{{ hazard.description | autoTranslate }}
```

Flow:
1. Returns original text immediately
2. Calls `WebTranslationService.translate()` in the background
3. When the translation resolves, calls `ChangeDetectorRef.markForCheck()` to re-render
4. On subsequent change detection cycles, returns the cached translation

The pipe skips translation when the current language is English or unsupported.

#### When to use which pipe

| Pipe | Use for | Example |
|------|---------|---------|
| `translate` | Static UI strings with known keys | `{{ 'locationCard.govActions.all' \| translate }}` |
| `autoTranslate` | Dynamic data from the API when plain text is required | `{{ hazard.description \| autoTranslate }}` |
| `protectedTranslationHtml` | Rendered dynamic translated text that may contain acronyms | `<span [innerHTML]="hazard.description \| autoTranslate \| protectedTranslationHtml"></span>` |

Use `protectedTranslationHtml` for user-visible translated dynamic fields whenever the template can render sanitized HTML. It escapes the full text first, then wraps protected tokens in `<span translate="no" class="notranslate">...</span>` so browser/page translation does not alter acronyms.

### Where autoTranslate is used

- **Hazards tab:** hazard descriptions, vulnerable groups, impact text, exposure ranges
- **Government actions:** adaptation action fields, adaptation goal titles/descriptions, project seeking funding details
- **Solutions tab:** solution names
- **Location card:** hazard detail fields

## Language Switching

### UI

The language selector lives in the app header (`frontend/src/app/core/header/`). It's a Material menu button with a language icon that lists all available languages.

### LanguageService

`frontend/src/app/shared/services/language.service.ts`

Central service managing the current language:

- Exposes a `currentLang` signal (reactive, used by `WebTranslationService` and `AutoTranslatePipe`)
- Persists selection to `localStorage` under `preferredLanguage`
- Calls `ngx-translate`'s `TranslateService.use()` to switch static translations
- `init()` is called on app startup to restore the saved preference

### What happens on language switch

1. `LanguageService.switchLanguage(code)` is called
2. `currentLang` signal updates — triggers `autoTranslate` pipes to re-evaluate
3. `TranslateService.use(code)` fires — loads new i18n JSON and updates all `| translate` pipes
4. `WebTranslationService` looks up translations using source/target-aware cache keys
5. Dynamic content re-translates through the batching pipeline

## Environment Setup

### Backend

Set in `backend/.env`:

```env
GCP_PROJECT_ID=your-gcp-project-id
SUPPORTED_TRANSLATION_LANGUAGES=en,es,ja,pt,zh
```

The Google Cloud Translate API must be enabled on the project, and the service account (or local ADC credentials) must have the `cloudtranslate.translations.translate` permission.

### Frontend

No translation-specific environment variables. The frontend calls the backend translate endpoint relative to `environment.baseUrl`.

## Testing

### Backend

Tests in `backend/tests/api/v1/test_translate.py` mock the `translate_client` to avoid real API calls:

```bash
cd backend && pytest tests/api/v1/test_translate.py -v
```

### Frontend

Component tests that use `AutoTranslatePipe` need `HttpClient` providers (for the SDK client's fetch layer). The `WebTranslationService` can be mocked in tests to return original text.
