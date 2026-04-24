from app.api.v1.chatbot import router as chatbot_router
from app.api.v1.deps import require_api_key
from app.api.v1.hazards import router as hazards_router
from app.api.v1.locations import router as location_router
from app.api.v1.suggest_follow_ups import router as suggest_follow_ups_router
from app.api.v1.translate import router as translate_router
from app.shared.logging import logger
from fastapi import APIRouter, Depends

api_router = APIRouter(dependencies=[Depends(require_api_key)])

api_router.include_router(chatbot_router, prefix="/chats", tags=["chats"])
api_router.include_router(location_router, prefix="/locations", tags=["locations"])
api_router.include_router(
    suggest_follow_ups_router, prefix="/suggest-follow-ups", tags=["suggest-follow-ups"]
)


api_router.include_router(hazards_router, prefix="/hazards", tags=["hazards"])
api_router.include_router(translate_router, prefix="/translate", tags=["translate"])


@api_router.get("/health")
async def health_check():
    """Health check endpoint.

    Returns:
        dict: Health status information.
    """
    logger.info("health_check_called")
    return {"status": "healthy", "version": "1.0.0"}
