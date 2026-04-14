from app.api.v1.chatbot import router as chatbot_router
from app.api.v1.earth_engine import router as earth_engine_router
from app.api.v1.location import router as location_router
from app.api.v1.suggest_follow_ups import router as suggest_follow_ups_router
from app.api.v1.translate import router as translate_router
from app.shared.logging import logger
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(chatbot_router, tags=["chat"])
api_router.include_router(location_router, prefix="/location", tags=["location"])
api_router.include_router(
    suggest_follow_ups_router, prefix="/suggest-follow-ups", tags=["suggest-follow-ups"]
)


api_router.include_router(earth_engine_router, prefix="/ee", tags=["earth_engine"])
api_router.include_router(translate_router, tags=["translate"])


@api_router.get("/health")
async def health_check():
    """Health check endpoint.

    Returns:
        dict: Health status information.
    """
    logger.info("health_check_called")
    return {"status": "healthy", "version": "1.0.0"}
