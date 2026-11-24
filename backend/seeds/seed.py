"""Seed the CSTAR tables with one sample discloser (local, preview and test DBs).

Run from backend/ after migrating: `uv run python -m seeds.seed`.
Safe to re-run (upserts by primary key); refuses to run in production.
"""

import asyncio

from sqlmodel.ext.asyncio.session import AsyncSession

from app.services.clients.database.base import database_service
from app.shared.config import Environment, settings
from seeds import (
    actions,
    dim_central,
    goals,
    hazards,
    peer_solutions,
    projects,
    solution_examples,
)

TABLES = [
    dim_central,
    hazards,
    goals,
    actions,
    projects,
    peer_solutions,
    solution_examples,
]


async def seed() -> None:
    if settings.ENVIRONMENT == Environment.PRODUCTION:
        raise SystemExit("Refusing to seed: APP_ENV is production.")

    database_service.initialize()
    try:
        async with AsyncSession(database_service.engine) as session:
            for table in TABLES:
                for row in table.ROWS:
                    # merge = insert, or update the row with the same primary key.
                    await session.merge(row)
            await session.commit()
        print(f"Seeded {len(TABLES)} tables")
    finally:
        await database_service.engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
