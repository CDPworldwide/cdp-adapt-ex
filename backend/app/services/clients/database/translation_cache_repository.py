"""Repository for persisted translation cache entries."""

from datetime import UTC, datetime
from hashlib import sha256
from typing import Callable

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.translation_cache import TranslationCache

TRANSLATION_CACHE_PROVIDER = "google_translate_v3"


def translation_source_hash(text: str) -> str:
    """Return a stable cache hash for exact source text."""

    return sha256(text.encode("utf-8")).hexdigest()


class TranslationCacheRepository:
    def __init__(self, engine: AsyncEngine | Callable[[], AsyncEngine]):
        self._engine = engine

    @property
    def engine(self) -> AsyncEngine:
        if callable(self._engine):
            return self._engine()
        return self._engine

    async def get_cached_translations(
        self,
        *,
        source_language: str,
        target_language: str,
        texts: list[str],
    ) -> dict[str, str]:
        if not texts:
            return {}

        hashes = [translation_source_hash(text) for text in texts]
        statement = select(TranslationCache).where(
            TranslationCache.source_language == source_language,
            TranslationCache.target_language == target_language,
            TranslationCache.source_hash.in_(hashes),
        )

        async with AsyncSession(self.engine) as session:
            records = (await session.exec(statement)).all()

        requested_texts = set(texts)
        return {
            record.source_text: record.translated_text
            for record in records
            if record.source_text in requested_texts
        }

    async def upsert_translations(
        self,
        *,
        source_language: str,
        target_language: str,
        translations: dict[str, str],
    ) -> None:
        translations = {
            source_text: translated_text
            for source_text, translated_text in translations.items()
            if translated_text != source_text
        }
        if not translations:
            return

        hashes = [
            translation_source_hash(source_text) for source_text in translations
        ]
        statement = select(TranslationCache).where(
            TranslationCache.source_language == source_language,
            TranslationCache.target_language == target_language,
            TranslationCache.source_hash.in_(hashes),
        )

        async with AsyncSession(self.engine) as session:
            existing_records = (await session.exec(statement)).all()
            existing_by_hash = {
                record.source_hash: record for record in existing_records
            }
            now = datetime.now(UTC)

            for source_text, translated_text in translations.items():
                source_hash = translation_source_hash(source_text)
                record = existing_by_hash.get(source_hash)
                if record and record.source_text == source_text:
                    record.translated_text = translated_text
                    record.provider = TRANSLATION_CACHE_PROVIDER
                    record.updated_at = now
                    session.add(record)
                    continue

                session.add(
                    TranslationCache(
                        source_language=source_language,
                        target_language=target_language,
                        source_hash=source_hash,
                        source_text=source_text,
                        translated_text=translated_text,
                        provider=TRANSLATION_CACHE_PROVIDER,
                        updated_at=now,
                    )
                )

            await session.commit()
