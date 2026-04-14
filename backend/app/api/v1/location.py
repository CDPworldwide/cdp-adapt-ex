from app.api.v1.deps import get_location_details_service
from app.models.location_details import OrganizationSummary
from app.schemas.location_v2 import LocationPin, LocationProfile
from app.services.impls.location_details_service import LocationDetailsService
from app.shared.exceptions import (
    CityGeometryMissingException,
    CityNotFoundException,
    MultipleCitiesFoundException,
)
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/names", response_model=list[OrganizationSummary])
async def get_all_location_names(
    location_service: LocationDetailsService = Depends(get_location_details_service),
):
    # TODO: Also get country names
    """Get all location names.

    Args:
        location_service: Service dependency used to fetch location details.

    Returns:
        A list of location names with organization IDs.
    """
    return await location_service.get_all_location_summaries()


@router.get(
    "/id/{organization_id}",
    response_model=LocationProfile,
    responses={
        404: {
            "description": "Location not found.",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string"},
                        },
                        "required": ["detail"],
                    }
                }
            },
        },
    },
)
async def get_location_by_org_id(
    organization_id: int,
    location_service: LocationDetailsService = Depends(get_location_details_service),
):
    """Get location details by organization ID."""
    try:
        return await location_service.get_location_details_by_org_id(organization_id)
    except CityNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except CityGeometryMissingException as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/pins", response_model=list[LocationPin])
async def get_all_location_pins(
    location_service: LocationDetailsService = Depends(get_location_details_service),
):
    """Get all location pins with their coordinates.

    Args:
        location_service: Service dependency used to fetch location details.

    Returns:
        A list of all eligible location pins.
    """
    return await location_service.get_all_location_pins()


@router.get(
    "/{location_name}",
    response_model=LocationProfile,
    responses={
        300: {
            "description": "Multiple matching locations found.",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string"},
                            "candidates": {
                                "type": "array",
                                "items": {"type": "string"},
                            },
                        },
                        "required": ["detail", "candidates"],
                    }
                }
            },
        },
        404: {
            "description": "Location not found.",
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "detail": {"type": "string"},
                        },
                        "required": ["detail"],
                    }
                }
            },
        },
    },
)
async def get_location(
    location_name: str,
    location_service: LocationDetailsService = Depends(get_location_details_service),
):
    """Get location details by name.

    Args:
        location_name: The unique name of the location to retrieve.
        location_service: Service dependency used to fetch location details.

    Returns:
        The requested :class:`app.schemas.location_v2.LocationProfile` instance.

    Raises:
        HTTPException: 404 if the location does not exist.
    """

    try:
        location = await location_service.get_eligible_location_details_by_name(
            location_name
        )
    except CityNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except CityGeometryMissingException as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except MultipleCitiesFoundException as e:
        return JSONResponse(
            status_code=300,
            content={"detail": str(e), "candidates": e.candidates},
        )
    return location
