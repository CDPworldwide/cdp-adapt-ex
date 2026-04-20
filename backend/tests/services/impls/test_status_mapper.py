"""Tests for StatusMapper."""

import pytest
from app.schemas.location import ActionStatusEnum
from app.services.impls.status_mapper import StatusMapper


@pytest.fixture
def status_mapper():
    return StatusMapper()


class TestMapStatus:
    def test_map_exact_status(self, status_mapper):
        result = status_mapper.map_string_to_status("Scoping")
        assert result is not None
        assert result.status_type == ActionStatusEnum.SCOPING
        assert result.other_status_details is None

    def test_map_empty_status_returns_none(self, status_mapper):
        assert status_mapper.map_string_to_status("") is None

    def test_map_unmapped_status_logs_warning_message(self, status_mapper, caplog):
        result = status_mapper.map_string_to_status("Unknown Status", org_id=123)
        assert result is None
        assert "Unknown status: 'Unknown Status' for org_id=123" in caplog.text
        assert "WARNING" in caplog.text

    def test_map_other_status_with_details(self, status_mapper):
        result = status_mapper.map_string_to_status("Other: Awaiting funding decision")
        assert result is not None
        assert result.status_type == ActionStatusEnum.OTHERS
        assert result.other_status_details == "Awaiting funding decision"

    def test_map_other_status_without_details_returns_none(self, status_mapper):
        assert status_mapper.map_string_to_status("Other:") is None
        assert status_mapper.map_string_to_status("Other:   ") is None
