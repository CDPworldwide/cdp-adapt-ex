from app.api.v1.deps import (
    get_location_details_service,
    get_location_profile_translation_service,
)
from app.schemas.location import (
    LocationNamesResponse,
    LocationProfile,
    LocationPinsResponse,
    LocationResponse,
    LocationSeoResponse,
)
from app.services.impls.location_details_service import LocationDetailsService
from app.services.impls.location_profile_translation_service import (
    LocationProfileTranslationService,
    normalize_translation_language,
)
from app.shared.exceptions import (
    CityGeometryMissingException,
    CityNotFoundException,
    MultipleCitiesFoundException,
)
from app.shared.config import settings
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/names", response_model=LocationNamesResponse)
async def get_all_location_names(
    location_service: LocationDetailsService = Depends(get_location_details_service),
) -> LocationNamesResponse:
    # TODO: Also get country names
    """Get all location names.

    Args:
        location_service: Service dependency used to fetch location details.

    Returns:
        A list of location names with organization IDs.
    """
    locations = await location_service.get_all_location_summaries()
    return LocationNamesResponse(locations=locations)


@router.get("/seo", response_model=LocationSeoResponse)
async def get_location_seo_summaries(
    location_service: LocationDetailsService = Depends(get_location_details_service),
) -> LocationSeoResponse:
    """Get lightweight organization metadata for static SEO artifact generation."""
    locations = await location_service.get_location_seo_summaries()
    return LocationSeoResponse(locations=locations)


@router.get(
    "/id/{organization_id}",
    response_model=LocationResponse,
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
    profile_translation_service: LocationProfileTranslationService = Depends(
        get_location_profile_translation_service
    ),
    target_language: str = "en",
) -> LocationResponse:
    """Get location details by organization ID."""
    try:
        location = await location_service.get_location_details_by_org_id(
            organization_id
        )
        location = await translate_location_response(
            location,
            target_language,
            profile_translation_service,
        )
        return LocationResponse(location=location)
    except CityNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except CityGeometryMissingException as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/pins", response_model=LocationPinsResponse)
async def get_all_location_pins(
    location_service: LocationDetailsService = Depends(get_location_details_service),
) -> LocationPinsResponse:
    """Get all location pins with their coordinates.

    Args:
        location_service: Service dependency used to fetch location details.

    Returns:
        A list of all eligible location pins.
    """
    pins = await location_service.get_all_location_pins()
    return LocationPinsResponse(pins=pins)


@router.get(
    "/{location_name}",
    response_model=LocationResponse,
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
    profile_translation_service: LocationProfileTranslationService = Depends(
        get_location_profile_translation_service
    ),
    target_language: str = "en",
) -> LocationResponse:
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
    location = await translate_location_response(
        location,
        target_language,
        profile_translation_service,
    )
    return LocationResponse(location=location)


async def translate_location_response(
    location: LocationProfile,
    target_language: str,
    profile_translation_service: LocationProfileTranslationService,
) -> LocationProfile:
    target_language = normalize_translation_language(target_language)
    if target_language not in settings.SUPPORTED_TRANSLATION_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {target_language}",
        )
    return await profile_translation_service.translate_profile(
        location, target_language
    )
