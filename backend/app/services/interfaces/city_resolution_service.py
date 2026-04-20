from typing import Optional, Protocol


class CityResolutionService(Protocol):
    async def resolve_org_id(self, city_name: str) -> Optional[int]: ...
