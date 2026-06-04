from __future__ import annotations

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass

from google.cloud import translate_v3 as translate

from app.services.clients.translation_text_processor import (
    PLACEHOLDER_PATTERN,
    PreparedText,
    protect_acronyms,
    restore_acronyms,
    validate_restored_acronyms,
)
from app.shared.config import settings
from app.shared.logging import logger

DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24
DEFAULT_MAX_CACHE_ENTRIES = 5000
MAX_TRANSLATE_TEXTS_PER_REQUEST = 50
MAX_TRANSLATE_CODEPOINTS_PER_REQUEST = 28_000


@dataclass
class _CacheEntry:
    value: str
    expires_at: float


class TranslateClient:
    """Client for Google Cloud Translation API v3."""

    def __init__(
        self,
        *,
        cache_ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS,
        max_cache_entries: int = DEFAULT_MAX_CACHE_ENTRIES,
    ):
        self._client: translate.TranslationServiceClient | None = None
        self._lock = threading.Lock()
        self._cache_lock = threading.Lock()
        self._cache_ttl_seconds = cache_ttl_seconds
        self._max_cache_entries = max_cache_entries
        self._cache: OrderedDict[tuple[str, str, str], _CacheEntry] = OrderedDict()

    @property
    def client(self) -> translate.TranslationServiceClient:
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = translate.TranslationServiceClient()
        return self._client

    @property
    def parent(self) -> str:
        return f"projects/{settings.GCP_PROJECT_ID}/locations/global"

    @property
    def available(self) -> bool:
        return bool(settings.GCP_PROJECT_ID)

    def translate_texts(
        self,
        texts: list[str],
        target_language: str,
        source_language: str = "en",
    ) -> list[str]:
        if not texts:
            return []

        if not self.available:
            logger.warning(
                "translation_skipped", reason="GCP_PROJECT_ID not configured"
            )
            return list(texts)

        translations: list[str | None] = [None] * len(texts)
        pending: list[tuple[tuple[str, str, str], str]] = []
        pending_indexes_by_key: dict[tuple[str, str, str], list[int]] = {}

        for index, text in enumerate(texts):
            cache_key = self._cache_key(
                text=text,
                source_language=source_language,
                target_language=target_language,
            )
            cached = self._get_cached(cache_key)
            if cached is None:
                if cache_key not in pending_indexes_by_key:
                    pending.append((cache_key, text))
                    pending_indexes_by_key[cache_key] = []
                pending_indexes_by_key[cache_key].append(index)
            else:
                translations[index] = cached

        if not pending:
            return [
                translation if translation is not None else text
                for translation, text in zip(translations, texts, strict=False)
            ]

        pending_texts = [text for _, text in pending]
        prepared_texts = [protect_acronyms(text) for text in pending_texts]
        contents = [prepared.text for prepared in prepared_texts]

        for batch_start, batch_end in self._request_ranges(prepared_texts):
            batch_prepared_texts = prepared_texts[batch_start:batch_end]
            batch_pending_texts = pending_texts[batch_start:batch_end]
            batch_contents = contents[batch_start:batch_end]

            try:
                response = self.client.translate_text(
                    contents=batch_contents,
                    target_language_code=target_language,
                    source_language_code=source_language,
                    parent=self.parent,
                    mime_type="text/plain",
                )

                for response_offset, (translation, prepared, original_text) in enumerate(
                    zip(
                        response.translations,
                        batch_prepared_texts,
                        batch_pending_texts,
                        strict=False,
                    )
                ):
                    pending_index = batch_start + response_offset
                    restored = restore_acronyms(
                        translation.translated_text, prepared.placeholders
                    )
                    validation = validate_restored_acronyms(original_text, restored)
                    if validation.is_valid:
                        cache_key = pending[pending_index][0]
                        for original_index in pending_indexes_by_key[cache_key]:
                            translations[original_index] = restored
                        self._store_cached(cache_key, restored)
                        continue

                    cache_key = pending[pending_index][0]
                    logger.warning(
                        "translation_acronym_validation_failed",
                        source_language=source_language,
                        target_language=target_language,
                        index=pending_indexes_by_key[cache_key][0],
                        missing_count=len(validation.missing),
                        duplicated_count=len(validation.duplicated),
                        mutated_count=len(validation.mutated),
                        failure_type=_validation_failure_type(validation),
                    )
                    repaired = self._translate_around_acronyms(
                        prepared=prepared,
                        source_language=source_language,
                        target_language=target_language,
                    )
                    if repaired is not None:
                        repaired_validation = validate_restored_acronyms(
                            original_text, repaired
                        )
                        if repaired_validation.is_valid:
                            self._store_cached(cache_key, repaired)
                            for original_index in pending_indexes_by_key[cache_key]:
                                translations[original_index] = repaired
                            continue

                        logger.warning(
                            "translation_acronym_repair_failed",
                            source_language=source_language,
                            target_language=target_language,
                            index=pending_indexes_by_key[cache_key][0],
                            missing_count=len(repaired_validation.missing),
                            duplicated_count=len(repaired_validation.duplicated),
                            mutated_count=len(repaired_validation.mutated),
                            failure_type=_validation_failure_type(repaired_validation),
                        )

                    for original_index in pending_indexes_by_key[cache_key]:
                        translations[original_index] = original_text

                for pending_index in range(
                    batch_start + len(response.translations), batch_end
                ):
                    cache_key, original_text = pending[pending_index]
                    for original_index in pending_indexes_by_key[cache_key]:
                        translations[original_index] = original_text

            except Exception as e:
                logger.error(
                    "translation_failed",
                    error=str(e),
                    target_language=target_language,
                    text_count=len(batch_pending_texts),
                )
                for pending_index, prepared in zip(
                    range(batch_start, batch_end), batch_prepared_texts, strict=False
                ):
                    cache_key = pending[pending_index][0]
                    restored = restore_acronyms(prepared.text, prepared.placeholders)
                    for original_index in pending_indexes_by_key[cache_key]:
                        translations[original_index] = restored

        return [
            translation if translation is not None else text
            for translation, text in zip(translations, texts, strict=False)
        ]

    def _translate_around_acronyms(
        self,
        *,
        prepared: PreparedText,
        source_language: str,
        target_language: str,
    ) -> str | None:
        if not prepared.placeholders:
            return None

        segments = self._split_acronym_segments(prepared)
        translatable_segments = [
            segment for segment in segments if isinstance(segment, _TranslatableSegment)
        ]
        if not translatable_segments:
            return restore_acronyms(prepared.text, prepared.placeholders)

        try:
            translated_segments = self._translate_plain_segments(
                [segment.text for segment in translatable_segments],
                source_language=source_language,
                target_language=target_language,
            )
        except Exception as e:
            logger.warning(
                "translation_acronym_repair_request_failed",
                error=str(e),
                source_language=source_language,
                target_language=target_language,
            )
            return None

        translated_by_index = dict(
            zip(
                (segment.index for segment in translatable_segments),
                translated_segments,
                strict=False,
            )
        )

        restored_parts: list[str] = []
        for index, segment in enumerate(segments):
            if isinstance(segment, _TranslatableSegment):
                translated = translated_by_index.get(index, segment.text)
                restored_parts.append(f"{segment.leading}{translated}{segment.trailing}")
            else:
                restored_parts.append(segment)

        return "".join(restored_parts)

    def _split_acronym_segments(
        self,
        prepared: PreparedText,
    ) -> list[str | "_TranslatableSegment"]:
        segments: list[str | _TranslatableSegment] = []
        cursor = 0

        for match in PLACEHOLDER_PATTERN.finditer(prepared.text):
            if match.start() > cursor:
                self._append_translatable_segment(
                    segments,
                    prepared.text[cursor : match.start()],
                )

            placeholder = match.group(0)
            segments.append(prepared.placeholders.get(placeholder, placeholder))
            cursor = match.end()

        if cursor < len(prepared.text):
            self._append_translatable_segment(segments, prepared.text[cursor:])

        return segments

    def _append_translatable_segment(
        self,
        segments: list[str | "_TranslatableSegment"],
        text: str,
    ) -> None:
        if not text:
            return

        stripped = text.strip()
        if not stripped:
            segments.append(text)
            return

        leading = text[: len(text) - len(text.lstrip())]
        trailing = text[len(text.rstrip()) :]
        segments.append(
            _TranslatableSegment(
                index=len(segments),
                text=stripped,
                leading=leading,
                trailing=trailing,
            )
        )

    def _translate_plain_segments(
        self,
        segments: list[str],
        *,
        source_language: str,
        target_language: str,
    ) -> list[str]:
        translations: list[str] = []
        prepared_segments = [_PlainPreparedSegment(text=segment) for segment in segments]

        for batch_start, batch_end in self._request_ranges(prepared_segments):
            batch_segments = prepared_segments[batch_start:batch_end]
            response = self.client.translate_text(
                contents=[segment.text for segment in batch_segments],
                target_language_code=target_language,
                source_language_code=source_language,
                parent=self.parent,
                mime_type="text/plain",
            )
            translations.extend(
                translation.translated_text for translation in response.translations
            )
            if len(response.translations) < len(batch_segments):
                translations.extend(
                    segment.text
                    for segment in batch_segments[len(response.translations) :]
                )

        return translations

    def _request_ranges(self, prepared_texts) -> list[tuple[int, int]]:
        ranges: list[tuple[int, int]] = []
        start = 0
        current_codepoints = 0

        for index, prepared in enumerate(prepared_texts):
            text_codepoints = len(prepared.text)
            current_count = index - start
            would_exceed_count = current_count >= MAX_TRANSLATE_TEXTS_PER_REQUEST
            would_exceed_codepoints = (
                current_count > 0
                and current_codepoints + text_codepoints
                > MAX_TRANSLATE_CODEPOINTS_PER_REQUEST
            )

            if would_exceed_count or would_exceed_codepoints:
                ranges.append((start, index))
                start = index
                current_codepoints = 0

            current_codepoints += text_codepoints

        if start < len(prepared_texts):
            ranges.append((start, len(prepared_texts)))

        return ranges

    def _cache_key(
        self, *, text: str, source_language: str, target_language: str
    ) -> tuple[str, str, str]:
        return (source_language, target_language, text)

    def _get_cached(self, key: tuple[str, str, str]) -> str | None:
        if self._cache_ttl_seconds <= 0 or self._max_cache_entries <= 0:
            return None

        now = time.monotonic()
        with self._cache_lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if entry.expires_at <= now:
                self._cache.pop(key, None)
                return None
            self._cache.move_to_end(key)
            return entry.value

    def _store_cached(self, key: tuple[str, str, str], value: str) -> None:
        if self._cache_ttl_seconds <= 0 or self._max_cache_entries <= 0:
            return

        expires_at = time.monotonic() + self._cache_ttl_seconds
        with self._cache_lock:
            self._cache[key] = _CacheEntry(value=value, expires_at=expires_at)
            self._cache.move_to_end(key)
            while len(self._cache) > self._max_cache_entries:
                self._cache.popitem(last=False)


translate_client = TranslateClient()


def _validation_failure_type(validation) -> str:
    if validation.missing:
        return "missing"
    if validation.duplicated:
        return "duplicated"
    return "mutated"


@dataclass(frozen=True)
class _TranslatableSegment:
    index: int
    text: str
    leading: str = ""
    trailing: str = ""


@dataclass(frozen=True)
class _PlainPreparedSegment:
    text: str
