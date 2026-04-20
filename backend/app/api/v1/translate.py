from app.api.v1.deps import get_translate_client
from app.schemas.translate import TranslateRequest, TranslateResponse
from app.services.clients.translate_client import TranslateClient
from app.shared.config import settings
from app.shared.limiter import limiter
from app.shared.logging import logger
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool

router = APIRouter()


@router.post("", response_model=TranslateResponse)
@limiter.limit("60 per minute")
async def translate_texts(
    request: Request,
    translate_request: TranslateRequest,
    client: TranslateClient = Depends(get_translate_client),
) -> TranslateResponse:
    """Translate an array of texts to the target language."""
    if (
        translate_request.target_language
        not in settings.SUPPORTED_TRANSLATION_LANGUAGES
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {translate_request.target_language}",
        )

    if translate_request.target_language == translate_request.source_language:
        return TranslateResponse(
            translations=translate_request.texts,
            source_language=translate_request.source_language,
            target_language=translate_request.target_language,
        )

    logger.info(
        "translate_request_received",
        text_count=len(translate_request.texts),
        target_language=translate_request.target_language,
    )

    translations = await run_in_threadpool(
        client.translate_texts,
        texts=translate_request.texts,
        target_language=translate_request.target_language,
        source_language=translate_request.source_language,
    )

    return TranslateResponse(
        translations=translations,
        source_language=translate_request.source_language,
        target_language=translate_request.target_language,
    )
