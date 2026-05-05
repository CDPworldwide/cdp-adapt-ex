import threading

from google.cloud import translate_v3 as translate

from app.services.clients.translation_text_processor import (
    protect_acronyms,
    restore_acronyms,
)
from app.shared.config import settings
from app.shared.logging import logger


class TranslateClient:
    """Client for Google Cloud Translation API v3."""

    def __init__(self):
        self._client: translate.TranslationServiceClient | None = None
        self._lock = threading.Lock()

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

        prepared_texts = [protect_acronyms(text) for text in texts]
        contents = [prepared.text for prepared in prepared_texts]

        try:
            response = self.client.translate_text(
                contents=contents,
                target_language_code=target_language,
                source_language_code=source_language,
                parent=self.parent,
                mime_type="text/plain",
            )

            return [
                restore_acronyms(translation.translated_text, prepared.placeholders)
                for translation, prepared in zip(
                    response.translations, prepared_texts, strict=False
                )
            ]

        except Exception as e:
            logger.error(
                "translation_failed",
                error=str(e),
                target_language=target_language,
                text_count=len(texts),
            )
            return [
                restore_acronyms(prepared.text, prepared.placeholders)
                for prepared in prepared_texts
            ]


translate_client = TranslateClient()
