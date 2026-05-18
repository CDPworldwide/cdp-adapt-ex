from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.schemas.location import LocationProfile
from app.services.clients.database.translation_cache_repository import (
    TranslationCacheRepository,
)
from app.services.clients.translation_text_processor import validate_restored_acronyms
from app.services.clients.translate_client import TranslateClient
from app.shared.logging import logger

TRANSLATION_BATCH_SIZE = 50

LANGUAGE_ALIASES: dict[str, str] = {
    "chinese": "zh",
    "chinese simplified": "zh",
    "chinese traditional": "zh",
    "en": "en",
    "eng": "en",
    "english": "en",
    "es": "es",
    "espanol": "es",
    "español": "es",
    "ja": "ja",
    "japanese": "ja",
    "jp": "ja",
    "mandarin": "zh",
    "portuguese": "pt",
    "portugues": "pt",
    "português": "pt",
    "pt": "pt",
    "spanish": "es",
    "zh": "zh",
    "zh-cn": "zh",
    "zh-hans": "zh",
    "zh-hant": "zh",
    "zh-tw": "zh",
}

TRANSLATION_FIELDS: tuple[str, ...] = (
    "hazards.statistics.vulnerable_sectors[].other_sector_details",
    "hazards.hazards[].hazard.other_hazard_details",
    "hazards.hazards[].description",
    "hazards.hazards[].vulnerable_groups[]",
    "hazards.hazards[].impact",
    "hazards.hazards[].most_exposed_sectors[].other_sector_details",
    "government_actions.goals[].title",
    "government_actions.goals[].hazards_addressed[].other_hazard_details",
    "government_actions.goals[].metric_indicator",
    "government_actions.goals[].comment",
    "government_actions.actions[].title",
    "government_actions.actions[].description",
    "government_actions.actions[].status.other_status_details",
    "government_actions.actions[].co_benefits[]",
    "government_actions.actions[].resilience_enhanced[]",
    "government_actions.actions[].hazards_addressed[].other_hazard_details",
    "government_actions.actions[].impacted_sectors[].other_sector_details",
    "government_actions.projects[].title",
    "government_actions.projects[].description",
    "government_actions.projects[].project_area",
    "government_actions.projects[].finance_status",
    "government_actions.projects[].finance_model[]",
    "government_actions.projects[].hazards_addressed[].other_hazard_details",
    "solutions.solutions.*[].solution",
    "solutions.solutions.*[].solution_hazards_addressed[].other_hazard_details",
    "solutions.solutions.*[].peer_actions[].peer_name",
    "solutions.solutions.*[].peer_actions[].action.title",
    "solutions.solutions.*[].peer_actions[].action.description",
    "solutions.solutions.*[].peer_actions[].action.status.other_status_details",
    "solutions.solutions.*[].peer_actions[].action.co_benefits[]",
    "solutions.solutions.*[].peer_actions[].action.resilience_enhanced[]",
    "solutions.solutions.*[].peer_actions[].action.hazards_addressed[].other_hazard_details",
    "solutions.solutions.*[].peer_actions[].action.impacted_sectors[].other_sector_details",
)


@dataclass(frozen=True)
class TranslationAssignment:
    parent: dict[str, Any] | list[Any]
    key: str | int
    value: str


class LocationProfileTranslationService:
    def __init__(
        self,
        translate_client: TranslateClient,
        translation_cache_repository: TranslationCacheRepository | None = None,
    ):
        self.translate_client = translate_client
        self.translation_cache_repository = translation_cache_repository

    async def translate_profile(
        self,
        profile: LocationProfile,
        target_language: str,
    ) -> LocationProfile:
        target_language = normalize_translation_language(target_language)
        source_language = normalize_translation_language(profile.reporting_language)

        if target_language == "en" or target_language == source_language:
            return profile

        if not getattr(self.translate_client, "available", True):
            return profile

        profile_data = profile.model_dump(mode="json")
        assignments = self._collect_assignments(profile_data)
        if not assignments:
            return profile

        translations = await self._translate_unique_values(
            assignments,
            source_language=source_language,
            target_language=target_language,
        )

        translated_any = False
        for assignment in assignments:
            translated = translations.get(assignment.value)
            if translated is not None:
                assignment.parent[assignment.key] = translated
                translated_any = translated_any or translated != assignment.value

        if not translated_any:
            return profile

        profile_data["reporting_language"] = target_language
        return LocationProfile.model_validate(profile_data)

    def _collect_assignments(
        self, profile_data: dict[str, Any]
    ) -> list[TranslationAssignment]:
        assignments: list[TranslationAssignment] = []
        for field in TRANSLATION_FIELDS:
            assignments.extend(self._walk_path(profile_data, field.split(".")))
        return assignments

    def _walk_path(
        self,
        value: Any,
        segments: list[str],
    ) -> list[TranslationAssignment]:
        if value is None or not segments:
            return []

        segment, *rest = segments

        if segment == "*[]":
            if not isinstance(value, dict):
                return []
            return [
                assignment
                for child in value.values()
                if isinstance(child, list)
                for item in child
                for assignment in self._walk_path(item, rest)
            ]

        if segment.endswith("[]"):
            key = segment[:-2]
            array_value = value.get(key) if key and isinstance(value, dict) else value
            if not isinstance(array_value, list):
                return []
            if not rest:
                return [
                    TranslationAssignment(array_value, index, item)
                    for index, item in enumerate(array_value)
                    if self._is_translatable_text(item)
                ]
            return [
                assignment
                for item in array_value
                for assignment in self._walk_path(item, rest)
            ]

        if not isinstance(value, dict) or segment not in value:
            return []

        if not rest:
            text = value[segment]
            if self._is_translatable_text(text):
                return [TranslationAssignment(value, segment, text)]
            return []

        return self._walk_path(value[segment], rest)

    async def _translate_unique_values(
        self,
        assignments: list[TranslationAssignment],
        *,
        source_language: str,
        target_language: str,
    ) -> dict[str, str]:
        unique_values = list(
            dict.fromkeys(assignment.value for assignment in assignments)
        )
        translated: dict[str, str] = {}
        cached = await self._get_cached_translations(
            source_language=source_language,
            target_language=target_language,
            texts=unique_values,
        )
        translated.update(cached)

        values_to_translate = [
            value for value in unique_values if value not in translated
        ]
        for index in range(0, len(values_to_translate), TRANSLATION_BATCH_SIZE):
            chunk = values_to_translate[index : index + TRANSLATION_BATCH_SIZE]
            translated_chunk = await run_in_threadpool(
                self.translate_client.translate_texts,
                texts=chunk,
                target_language=target_language,
                source_language=source_language,
            )
            translated_from_google = dict(zip(chunk, translated_chunk, strict=False))
            translated.update(translated_from_google)
            await self._store_cached_translations(
                source_language=source_language,
                target_language=target_language,
                translations={
                    source: translation
                    for source, translation in translated_from_google.items()
                    if translation != source
                },
            )

        return translated

    async def _get_cached_translations(
        self,
        *,
        source_language: str,
        target_language: str,
        texts: list[str],
    ) -> dict[str, str]:
        if self.translation_cache_repository is None:
            return {}

        try:
            cached = await self.translation_cache_repository.get_cached_translations(
                source_language=source_language,
                target_language=target_language,
                texts=texts,
            )
            return self._filter_valid_cached_translations(
                cached,
                source_language=source_language,
                target_language=target_language,
            )
        except Exception as e:
            logger.warning("translation_cache_read_failed", error=str(e))
            return {}

    async def _store_cached_translations(
        self,
        *,
        source_language: str,
        target_language: str,
        translations: dict[str, str],
    ) -> None:
        if self.translation_cache_repository is None:
            return

        try:
            await self.translation_cache_repository.upsert_translations(
                source_language=source_language,
                target_language=target_language,
                translations=translations,
            )
        except Exception as e:
            logger.warning("translation_cache_write_failed", error=str(e))

    def _filter_valid_cached_translations(
        self,
        cached: dict[str, str],
        *,
        source_language: str,
        target_language: str,
    ) -> dict[str, str]:
        valid: dict[str, str] = {}
        for source_text, translated_text in cached.items():
            validation = validate_restored_acronyms(source_text, translated_text)
            if validation.is_valid:
                valid[source_text] = translated_text
                continue

            logger.warning(
                "translation_cache_acronym_validation_failed",
                source_language=source_language,
                target_language=target_language,
                missing_count=len(validation.missing),
                duplicated_count=len(validation.duplicated),
                mutated_count=len(validation.mutated),
            )
        return valid

    def _is_translatable_text(self, value: Any) -> bool:
        return isinstance(value, str) and bool(value.strip())


def normalize_translation_language(value: str | None) -> str:
    normalized = (value or "en").strip().lower().replace("_", "-")
    while "  " in normalized:
        normalized = normalized.replace("  ", " ")

    if not normalized:
        return "en"

    alias = LANGUAGE_ALIASES.get(normalized)
    if alias:
        return alias

    base_language = normalized.split("-")[0]
    return LANGUAGE_ALIASES.get(base_language, normalized)
