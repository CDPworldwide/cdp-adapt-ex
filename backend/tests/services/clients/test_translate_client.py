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
                    "Plan de calor para [[PAC_ACRONYM_0]] con mejoras de [[PAC_ACRONYM_1]] y [[PAC_ACRONYM_2]]"
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
            "Plan de calor para [[PAC_ACRONYM_0]] con mejoras de [[PAC_ACRONYM_1]] y [[PAC_ACRONYM_2]]"
        ],
        target_language_code="en",
        source_language_code="es",
        parent="projects/test-project/locations/global",
        mime_type="text/plain",
    )
