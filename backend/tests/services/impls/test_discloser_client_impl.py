from unittest.mock import MagicMock, patch

import pytest
import requests
from app.services.impls.discloser_client_impl import (
    DEFAULT_DISCLOSER_SERVICE_BASE_URL,
    DiscloserClientImpl,
)


class TestDiscloserClientImpl:
    def test_successful_geometry_retrieval(self):
        client = DiscloserClientImpl(base_url="https://example.test")
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "geometry": {"type": "Point", "coordinates": [1.0, 2.0]}
        }

        with patch(
            "app.services.impls.discloser_client_impl.requests.get",
            return_value=response,
        ) as mock_get:
            result = client.get_geometry_by_organization_id("123")

        assert result == {"type": "Point", "coordinates": [1.0, 2.0]}
        mock_get.assert_called_once_with(
            "https://example.test/api/v1/db/crm_entity/123/geometry",
            timeout=10.0,
        )

    def test_404_returns_none(self):
        client = DiscloserClientImpl(base_url="https://example.test")
        response = MagicMock()
        response.status_code = 404

        with patch(
            "app.services.impls.discloser_client_impl.requests.get",
            return_value=response,
        ):
            result = client.get_geometry_by_organization_id("123")

        assert result is None

    def test_non_404_http_error_raises_runtime_error(self):
        client = DiscloserClientImpl(base_url="https://example.test")
        response = MagicMock()
        response.status_code = 500
        response.raise_for_status.side_effect = requests.HTTPError("500 Server Error")

        with patch(
            "app.services.impls.discloser_client_impl.requests.get",
            return_value=response,
        ):
            with pytest.raises(RuntimeError, match="status 500"):
                client.get_geometry_by_organization_id("123")

    def test_network_error_raises_runtime_error(self):
        client = DiscloserClientImpl(base_url="https://example.test")

        with patch(
            "app.services.impls.discloser_client_impl.requests.get",
            side_effect=requests.RequestException("network down"),
        ):
            with pytest.raises(RuntimeError, match="Unable to reach discloser service"):
                client.get_geometry_by_organization_id("123")

    def test_invalid_geometry_payload_raises_runtime_error(self):
        client = DiscloserClientImpl(base_url="https://example.test")
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"geometry": "not-a-dict"}

        with patch(
            "app.services.impls.discloser_client_impl.requests.get",
            return_value=response,
        ):
            with pytest.raises(RuntimeError, match="invalid geometry payload"):
                client.get_geometry_by_organization_id("123")

    def test_environment_variable_configuration(self):
        with patch.dict(
            "os.environ",
            {"DISCLOSER_SERVICE_BASE_URL": "https://env-base.test/"},
            clear=False,
        ):
            client = DiscloserClientImpl(base_url=None)

        assert client.base_url == "https://env-base.test"

    def test_default_configuration_when_env_not_set(self):
        with patch.dict("os.environ", {}, clear=True):
            client = DiscloserClientImpl(base_url=None)

        assert client.base_url == DEFAULT_DISCLOSER_SERVICE_BASE_URL
