from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
)
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.api import api_router
from app.services.clients.database import database_service
from app.shared.config import settings
from app.shared.limiter import limiter
from app.shared.logging import logger

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize singletons/connections
    logger.info("startup_event", message="Initializing services")

    if settings.SKIP_DATABASE_INIT:
        logger.info("startup_event", message="Skipping database initialization")
    else:
        database_service.initialize()

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
