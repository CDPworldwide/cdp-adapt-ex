"""Repository for persisting onboarding telemetry."""

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.onboarding import UserRoleSelection


class OnboardingRepository:
    def __init__(self, engine: AsyncEngine):
        self.engine = engine

    async def insert_role_selection(
        self,
        role: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> UserRoleSelection:
        record = UserRoleSelection(
            role=role,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        async with AsyncSession(self.engine) as session:
            session.add(record)
            await session.commit()
            await session.refresh(record)
        return record
