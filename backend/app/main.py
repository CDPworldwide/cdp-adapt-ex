from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
)
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from sqlmodel import SQLModel

from app.api.v1.api import api_router
from app.models.onboarding import UserRoleSelection
from app.models.translation_cache import TranslationCache
from app.services.clients.database import database_service
from app.shared.config import settings
from app.shared.limiter import limiter
from app.shared.logging import logger

# Tables fully owned by the API (writes go through SQLModel). Auto-created on
# startup so we don't need a migration tool for this set. Read-only analytical
# tables (DimCentral, FactHazards, etc.) are managed outside the app and must
# NOT be added here.
APP_OWNED_TABLES = [UserRoleSelection.__table__, TranslationCache.__table__]

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize singletons/connections
    logger.info("startup_event", message="Initializing services")

    if settings.SKIP_DATABASE_INIT:
        logger.info("startup_event", message="Skipping database initialization")
    else:
        database_service.initialize()
        async with database_service.engine.begin() as conn:
            await conn.run_sync(
                SQLModel.metadata.create_all, tables=APP_OWNED_TABLES
            )

    yield

    # Shutdown: Clean up resources
    logger.info("shutdown_event", message="Cleaning up services")
    if not settings.SKIP_DATABASE_INIT:
        database_service.close()


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials="*" not in settings.ALLOWED_ORIGINS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

app.include_router(api_router, prefix=settings.API_V1_STR)
