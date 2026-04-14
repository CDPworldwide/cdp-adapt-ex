"""Tests for SolutionCategoryMapper."""

import pytest
from app.schemas.location_v2 import SolutionCategoryEnum
from app.services.impls.solution_category_mapper import SolutionCategoryMapper


@pytest.fixture
def solution_category_mapper():
    return SolutionCategoryMapper()


def test_map_string_to_solution_category_known(solution_category_mapper):
    assert (
        solution_category_mapper.map_string_to_solution_category(
            "Engineered and built environment actions"
        )
        == SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT
    )
    assert (
        solution_category_mapper.map_string_to_solution_category(
            "   Economic actions   "
        )
        == SolutionCategoryEnum.ECONOMIC
    )
    assert (
        solution_category_mapper.map_string_to_solution_category(
            "Government policies and programs actions"
        )
        == SolutionCategoryEnum.GOVERNMENT_POLICIES_PROGRAMS
    )


def test_map_string_to_solution_category_unknown(solution_category_mapper):
    assert (
        solution_category_mapper.map_string_to_solution_category("Something else")
        is None
    )


def test_map_string_to_solution_category_empty(solution_category_mapper):
    assert solution_category_mapper.map_string_to_solution_category("") is None
    assert solution_category_mapper.map_string_to_solution_category("   ") is None
    assert solution_category_mapper.map_string_to_solution_category(None) is None
