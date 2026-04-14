"""Tests for SectorMapper."""

import pytest
from app.schemas.location_v2 import Sector, SectorEnum
from app.services.impls.sector_mapper import SectorMapper


@pytest.fixture
def sector_mapper():
    return SectorMapper()


def test_map_string_to_sector_known(sector_mapper):
    assert sector_mapper.map_string_to_sector("Agriculture") == Sector(
        sector_type=SectorEnum.AGRICULTURE
    )
    assert sector_mapper.map_string_to_sector("   Forestry   ") == Sector(
        sector_type=SectorEnum.FORESTRY
    )


def test_map_string_to_sector_other(sector_mapper):
    assert sector_mapper.map_string_to_sector("Other: Technology") == Sector(
        sector_type=SectorEnum.OTHERS, other_sector_details="Technology"
    )


def test_map_string_to_sector_unknown(sector_mapper):
    # Unknown sectors should be logged and return None
    assert sector_mapper.map_string_to_sector("Something else") is None


def test_map_string_to_sector_empty(sector_mapper):
    assert sector_mapper.map_string_to_sector("") is None
    assert sector_mapper.map_string_to_sector("   ") is None


def test_split_and_map_sectors_mixed(sector_mapper):
    input_str = "Agriculture | Forestry|Other: Tech| Something else"
    expected = [
        Sector(sector_type=SectorEnum.AGRICULTURE),
        Sector(sector_type=SectorEnum.FORESTRY),
        Sector(sector_type=SectorEnum.OTHERS, other_sector_details="Tech"),
    ]
    assert sector_mapper.split_and_map_sectors(input_str) == expected


def test_split_and_map_sectors_single(sector_mapper):
    input_str = "Agriculture"
    expected = [Sector(sector_type=SectorEnum.AGRICULTURE)]
    assert sector_mapper.split_and_map_sectors(input_str) == expected


def test_split_and_map_sectors_with_empty_parts(sector_mapper):
    input_str = "Agriculture | | Forestry"
    expected = [
        Sector(sector_type=SectorEnum.AGRICULTURE),
        Sector(sector_type=SectorEnum.FORESTRY),
    ]
    assert sector_mapper.split_and_map_sectors(input_str) == expected


def test_split_and_map_sectors_empty_string(sector_mapper):
    assert sector_mapper.split_and_map_sectors("") == []
    assert sector_mapper.split_and_map_sectors(None) == []
