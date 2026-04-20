"""Solution category mapping logic."""

from app.schemas.location import SolutionCategoryEnum
from app.shared.logging import logger

_SOLUTION_CATEGORY_MAPPING: dict[str, SolutionCategoryEnum] = {
    "Engineered and built environment actions": SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT,
    "Economic actions": SolutionCategoryEnum.ECONOMIC,
    "Laws and regulations actions": SolutionCategoryEnum.LAWS_REGULATIONS,
    "Technological actions": SolutionCategoryEnum.TECHNOLOGICAL,
    "Behavioural actions": SolutionCategoryEnum.BEHAVIOURAL,
    "Educational/Informational actions": SolutionCategoryEnum.EDUCATIONAL_INFORMATIONAL,
    "Ecosystem-based actions": SolutionCategoryEnum.ECOSYSTEM_BASED,
    "Services actions": SolutionCategoryEnum.SERVICES,
    "Government policies and programs actions": SolutionCategoryEnum.GOVERNMENT_POLICIES_PROGRAMS,
}


class SolutionCategoryMapper:
    """Utility to map raw database solution categories to typed enums."""

    def map_string_to_solution_category(
        self, db_string: str | None, org_id: int | None = None
    ) -> SolutionCategoryEnum | None:
        """Convert a database solution category string to a SolutionCategoryEnum."""
        if db_string is None:
            return None

        normalized = db_string.strip()
        if not normalized:
            return None

        category = _SOLUTION_CATEGORY_MAPPING.get(normalized)
        if category is None:
            log_message = f"Unknown solution category: '{db_string}'"
            if org_id is not None:
                log_message += f" for org_id={org_id}"
            logger.warning(log_message)

        return category
