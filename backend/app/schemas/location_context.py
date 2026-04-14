from typing import Annotated

from pydantic import Field

from app.schemas.location_v2 import LocationProfile

LocationContext = Annotated[
    LocationProfile | None,
    Field(
        default=None,
        alias="locationData",
        description="Location entry context from the location details endpoint",
    ),
]
