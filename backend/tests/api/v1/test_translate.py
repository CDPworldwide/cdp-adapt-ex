from unittest.mock import patch

import pytest


@pytest.mark.asyncio
async def test_translate_returns_translations(client):
    with patch(
        "app.services.clients.translate_client.translate_client.translate_texts",
        return_value=["Hola mundo"],
    ):
        response = await client.post(
            "/api/v1/translate",
            json={
                "texts": ["Hello world"],
                "target_language": "es",
                "source_language": "en",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["translations"] == ["Hola mundo"]
    assert data["source_language"] == "en"
    assert data["target_language"] == "es"


@pytest.mark.asyncio
async def test_translate_same_language_returns_original(client):
    response = await client.post(
        "/api/v1/translate",
        json={
            "texts": ["Hello world"],
            "target_language": "en",
            "source_language": "en",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["translations"] == ["Hello world"]


@pytest.mark.asyncio
async def test_translate_normalizes_language_codes(client):
    with patch(
        "app.services.clients.translate_client.translate_client.translate_texts",
        return_value=["Hello world"],
    ) as mock_translate:
        response = await client.post(
            "/api/v1/translate",
            json={
                "texts": ["Hola mundo"],
                "target_language": "EN",
                "source_language": " ES ",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["source_language"] == "es"
    assert data["target_language"] == "en"
    mock_translate.assert_called_once_with(
        texts=["Hola mundo"],
        target_language="en",
        source_language="es",
    )


@pytest.mark.asyncio
async def test_translate_unsupported_language_returns_400(client):
    response = await client.post(
        "/api/v1/translate",
        json={
            "texts": ["Hello world"],
            "target_language": "xx",
            "source_language": "en",
        },
    )

    assert response.status_code == 400
    assert "Unsupported target language" in response.json()["detail"]


@pytest.mark.asyncio
async def test_translate_empty_texts_returns_422(client):
    response = await client.post(
        "/api/v1/translate",
        json={
            "texts": [],
            "target_language": "es",
            "source_language": "en",
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_translate_multiple_texts(client):
    with patch(
        "app.services.clients.translate_client.translate_client.translate_texts",
        return_value=["Hola mundo", "Evaluación de riesgos climáticos"],
    ):
        response = await client.post(
            "/api/v1/translate",
            json={
                "texts": ["Hello world", "Climate hazard assessment"],
                "target_language": "es",
                "source_language": "en",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data["translations"]) == 2


@pytest.mark.asyncio
async def test_translate_service_unavailable_returns_original_texts(client):
    with patch(
        "app.services.clients.translate_client.settings",
    ) as mock_settings:
        mock_settings.GCP_PROJECT_ID = ""
        response = await client.post(
            "/api/v1/translate",
            json={
                "texts": ["Hello world"],
                "target_language": "es",
                "source_language": "en",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["translations"] == ["Hello world"]


@pytest.mark.asyncio
async def test_translate_too_many_texts_returns_422(client):
    response = await client.post(
        "/api/v1/translate",
        json={
            "texts": [f"text {i}" for i in range(51)],
            "target_language": "es",
            "source_language": "en",
        },
    )

    assert response.status_code == 422
