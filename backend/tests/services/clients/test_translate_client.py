from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.clients.translate_client import TranslateClient
from app.shared.config import settings


def test_translate_texts_preserves_acronyms_and_source_language(monkeypatch):
    monkeypatch.setattr(settings, "GCP_PROJECT_ID", "test-project")

    mock_client = MagicMock()
    mock_client.translate_text.return_value = SimpleNamespace(
        translations=[
            SimpleNamespace(
                translated_text=(
                    "Plan de calor para {PACACRONYM0} con mejoras de {PACACRONYM1} y {PACACRONYM2}"
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
            "Plan de calor para {PACACRONYM0} con mejoras de {PACACRONYM1} y {PACACRONYM2}"
        ],
        target_language_code="en",
        source_language_code="es",
        parent="projects/test-project/locations/global",
        mime_type="text/plain",
    )


def test_translate_texts_falls_back_when_acronyms_are_mutated(monkeypatch):
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
