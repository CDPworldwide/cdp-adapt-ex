from typing import List

from pydantic import BaseModel


class LocationStats(BaseModel):
    population: str
    populationContext: str
    gdp: str
    gdpContext: str
    area: str
    areaContext: str


class LocationDetails(BaseModel):
    locationName: str
    locationType: str
    quickFact: str
    stats: LocationStats
    concerns: List[str]
