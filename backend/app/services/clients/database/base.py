"""Database service with repository pattern.

This module provides a centralized database service that manages the connection
pool and provides access to entity-specific repositories. The key benefit is
maintaining a single connection pool for efficient reuse while logically
dividing up the code through repositories.

Usage:
    from app.services.clients.database.base import database_service

    # Initialize the database service (called on app startup)
    database_service.initialize()

    # Access repositories for CRUD operations
    location_details = await database_service.location_details.get_by_id("location-123")

    # Get a session for direct database operations
    session = database_service.get_session_maker()

    # Core database operations
    is_healthy = await database_service.health_check()

    # Close connections on app shutdown
    database_service.close()
"""

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import (
    select,
)
from sqlmodel.ext.asyncio.session import AsyncSession

from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.shared.config import (
    Environment,
    settings,
)
from app.shared.logging import logger


class DatabaseService:
    """Database service with repository pattern.

    This class manages the SQLAlchemy database engine and connection pool.
    Repositories are instantiated with the engine for decoupled data access.

    Attributes:
        engine: SQLAlchemy engine instance with connection pool
        location_details: LocationDetailsRepository for location_details CRUD operations
    """

    def __init__(self):
        """Initialize database service."""
        self._engine = None
        self._location_details = None

    def initialize(self):
        """Initialize the SQLAlchemy engine.

        This should be called on application startup.
        """
        if self._engine is not None:
            return

        try:
            # Configure environment-specific database connection pool settings
            pool_size = settings.POSTGRES_POOL_SIZE
            max_overflow = settings.POSTGRES_MAX_OVERFLOW

            # Create engine with appropriate pool configuration
            # Handle Cloud SQL Unix socket paths (start with /cloudsql/)
            if settings.POSTGRES_HOST.startswith("/cloudsql/"):
                connection_url = (
                    f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
                    f"@/{settings.POSTGRES_DB}?host={settings.POSTGRES_HOST}"
                )
            else:
                connection_url = (
                    f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
                    f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
                )

            self._engine = create_async_engine(
                connection_url,
                pool_pre_ping=True,
                pool_size=pool_size,
                max_overflow=max_overflow,
                pool_timeout=30,  # Connection timeout (seconds)
                pool_recycle=1800,  # Recycle connections after 30 minutes
            )

            # TODO: add schema management if needed
            self._location_details = LocationDetailsRepository(self._engine)

            logger.info(
                "database_initialized",
                environment=settings.ENVIRONMENT.value,
                pool_size=pool_size,
                max_overflow=max_overflow,
            )
        except SQLAlchemyError as e:
            logger.error(
                "database_initialization_error",
                error=str(e),
                environment=settings.ENVIRONMENT.value,
            )
            # In production, don't raise - allow app to start even with DB issues
            if settings.ENVIRONMENT != Environment.PRODUCTION:
                raise

    @property
    def engine(self):
        """Get the SQLAlchemy engine instance."""
        if self._engine is None:
            # Fallback for tests or scripts that might not call initialize()
            # But ideally, initialize() should be called explicitly.
            self.initialize()
        return self._engine

    @engine.setter
    def engine(self, value):
        """Set the SQLAlchemy engine instance. Useful for testing."""
        self._engine = value

    def close(self):
        """Dispose of the database engine."""
        if self._engine:
            self._engine.dispose()
            self._engine = None
            logger.info("database_connection_closed")

    @property
    def location_details(self):
        """Get the LocationDetailsRepository, initializing it if necessary."""
        self.initialize()
        return self._location_details

    def get_session_maker(self):
        """Get a session maker for creating database sessions.

        Returns:
            AsyncSession: A SQLModel async session maker
        """
        return AsyncSession(self.engine)

    async def health_check(self) -> bool:
        """Check database connection health.

        Returns:
            bool: True if database is healthy, False otherwise
        """
        try:
            async with AsyncSession(self.engine) as session:
                # Execute a simple query to check connection
                (await session.exec(select(1))).first()
                return True
        except Exception as e:
            logger.error("database_health_check_failed", error=str(e))
            return False


# Create a singleton instance
database_service = DatabaseService()
