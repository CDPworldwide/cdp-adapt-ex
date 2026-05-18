from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.clients.translate_client import (
    MAX_TRANSLATE_CODEPOINTS_PER_REQUEST,
    TranslateClient,
)
from app.shared.config import settings


def test_translate_texts_preserves_acronyms_and_source_language(monkeypatch):
    monkeypatch.setattr(settings, "GCP_PROJECT_ID", "test-project")

    mock_client = MagicMock()
    mock_client.translate_text.return_value = SimpleNamespace(
        translations=[
            SimpleNamespace(
                translated_text=(
                    "Plan de calor para X_PAC_0_X con mejoras de X_PAC_1_X y X_PAC_2_X"
                )
            )
        ]
    )

    client = TranslateClient()
    client._client = mock_client

    result = client.translate_texts(
        ["Plan de calor para CDP con mejoras de HVAC y M.O.S.E."],
        target_language="en",
        source_language="es",
    )

    assert result == ["Plan de calor para CDP con mejoras de HVAC y M.O.S.E."]
    mock_client.translate_text.assert_called_once_with(
        contents=[
            "Plan de calor para X_PAC_0_X con mejoras de X_PAC_1_X y X_PAC_2_X"
        ],
        target_language_code="en",
        source_language_code="es",
        parent="projects/test-project/locations/global",
        mime_type="text/plain",
    )


def test_translate_texts_falls_back_when_acronym_validation_fails(monkeypatch):
    monkeypatch.setattr(settings, "GCP_PROJECT_ID", "test-project")

    mock_client = MagicMock()
    mock_client.translate_text.return_value = SimpleNamespace(
        translations=[SimpleNamespace(translated_text="Plan for MOSE and HVAC-CDP")]
    )

    client = TranslateClient()
    client._client = mock_client

    result = client.translate_texts(
        ["Plan for M.O.S.E. and HVAC/CDP"],
        target_language="es",
        source_language="en",
    )

    assert result == ["Plan for M.O.S.E. and HVAC/CDP"]


def test_translate_texts_reuses_cached_translations(monkeypatch):
    monkeypatch.setattr(settings, "GCP_PROJECT_ID", "test-project")

    mock_client = MagicMock()
    mock_client.translate_text.return_value = SimpleNamespace(
        translations=[SimpleNamespace(translated_text="Hola mundo")]
    )

    client = TranslateClient()
    client._client = mock_client

    first = client.translate_texts(
        ["Hello world", "Hello world"],
        target_language="es",
        source_language="en",
    )
    second = client.translate_texts(
        ["Hello world"],
        target_language="es",
        source_language="en",
    )

    assert first == ["Hola mundo", "Hola mundo"]
    assert second == ["Hola mundo"]
    mock_client.translate_text.assert_called_once_with(
        contents=["Hello world"],
        target_language_code="es",
        source_language_code="en",
        parent="projects/test-project/locations/global",
        mime_type="text/plain",
    )


def test_translate_texts_splits_requests_by_codepoint_limit(monkeypatch):
    monkeypatch.setattr(settings, "GCP_PROJECT_ID", "test-project")

    long_texts = [
        "a" * (MAX_TRANSLATE_CODEPOINTS_PER_REQUEST // 2 + 1),
        "b" * (MAX_TRANSLATE_CODEPOINTS_PER_REQUEST // 2 + 1),
        "c" * (MAX_TRANSLATE_CODEPOINTS_PER_REQUEST // 2 + 1),
    ]

    mock_client = MagicMock()

    def translate_text(**kwargs):
        return SimpleNamespace(
            translations=[
                SimpleNamespace(translated_text=f"es:{content}")
                for content in kwargs["contents"]
            ]
        )

    mock_client.translate_text.side_effect = translate_text

    client = TranslateClient()
    client._client = mock_client

    result = client.translate_texts(
        long_texts,
        target_language="es",
        source_language="en",
    )

    assert result == [f"es:{text}" for text in long_texts]
    assert mock_client.translate_text.call_count == 3
    for call in mock_client.translate_text.call_args_list:
        contents = call.kwargs["contents"]
        assert sum(len(content) for content in contents) <= (
            MAX_TRANSLATE_CODEPOINTS_PER_REQUEST // 2 + 1
        )
