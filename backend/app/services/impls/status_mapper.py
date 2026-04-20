"""Status mapping logic."""

from typing import Optional

from app.schemas.location import (
    ActionStatus,
    ActionStatusEnum,
    PlannedProjectStatusEnum,
)
from app.shared.logging import logger


class StatusMapper:
    """Utility to map raw database status strings to a typed ActionStatus."""

    _action_status_map: dict[str, ActionStatusEnum] = {
        "Scoping": ActionStatusEnum.SCOPING,
        "Pre-feasibility study": ActionStatusEnum.PRE_FEASIBILITY_STUDY,
        "Feasibility finalized, but currently no finance secured": ActionStatusEnum.FEASIBILITY_FINALIZED_NO_FINANCE,
        "Feasibility finalized, and finance partially secured": ActionStatusEnum.FEASIBILITY_FINALIZED_PARTIAL_FINANCE,
        "Feasibility finalized, and finance fully secured": ActionStatusEnum.FEASIBILITY_FINALIZED_FULL_FINANCE,
        "Implementation complete in the reporting year": ActionStatusEnum.IMPLEMENTATION_COMPLETE_REPORTING_YEAR,
        "Implementation underway with completion expected in less than one year": ActionStatusEnum.IMPLEMENTATION_UNDERWAY_COMPLETION_LT_ONE_YEAR,
        "Implementation underway with completion expected in more than one year": ActionStatusEnum.IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR,
        "Action in operation (jurisdiction-wide)": ActionStatusEnum.ACTION_IN_OPERATION_JURISDICTION_WIDE,
        "Action in operation (across most of jurisdiction)": ActionStatusEnum.ACTION_IN_OPERATION_MOST_OF_JURISDICTION,
        "Action in operation (targeted to sector/location)": ActionStatusEnum.ACTION_IN_OPERATION_TARGETED,
        "Others": ActionStatusEnum.OTHERS,
    }

    def map_string_to_status(
        self, status_str: str, org_id: Optional[int] = None
    ) -> Optional[ActionStatus]:
        """Convert database string to ActionStatus.

        - Map known status strings to ActionStatusEnum.
        - For "Other: <details>" strings, set type to OTHERS and extracts details.
        - If a status is unknown, logs a warning and returns None.
        - Returns None for empty strings.
        """
        if status_str is None:
            return None
        normalized_string = status_str.strip()
        if not normalized_string:
            return None

        if normalized_string.startswith("Other:"):
            details = normalized_string.removeprefix("Other:").strip()
            if not details:
                return None  # Ignore "Other:" if no details are provided
            return ActionStatus(
                status_type=ActionStatusEnum.OTHERS,
                other_status_details=details,
            )

        status_type = self._action_status_map.get(normalized_string)
        if status_type:
            return ActionStatus(status_type=status_type)
        else:
            log_message = f"Unknown status: '{status_str}'"
            if org_id:
                log_message += f" for org_id={org_id}"
            logger.warning(log_message)
            return None

    # ------------------------------------------------------------------
    # Project / Funding-Gap status mapping
    # ------------------------------------------------------------------

    _project_status_map: dict[str, PlannedProjectStatusEnum] = {
        "Scoping": PlannedProjectStatusEnum.SCOPING,
        "Pre-feasibility": PlannedProjectStatusEnum.PRE_FEASIBILITY,
        "Project feasibility": PlannedProjectStatusEnum.PROJECT_FEASIBILITY,
        "Project structuring": PlannedProjectStatusEnum.PROJECT_STRUCTURING,
        "Transaction preparation": PlannedProjectStatusEnum.TRANSACTION_PREPARATION,
        "Implementation": PlannedProjectStatusEnum.IMPLEMENTATION,
        "Post-implementation": PlannedProjectStatusEnum.POST_IMPLEMENTATION,
    }

    def map_string_to_project_status(
        self, status_str: str | None
    ) -> PlannedProjectStatusEnum | None:
        """Convert a database development_stage string to PlannedProjectStatusEnum."""
        if not status_str or not status_str.strip():
            return None

        normalized = status_str.strip()
        status = self._project_status_map.get(normalized)
        if status:
            return status

        logger.warning(f"Unknown project status: '{status_str}'")
        return None
