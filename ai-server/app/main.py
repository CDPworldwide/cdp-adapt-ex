from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.api.follow_ups import router as follow_ups_router
from app.api.openai import router as openai_router
from app.observability import get_observability
from app.settings import Settings, get_settings

app = FastAPI(title="CDP AI Server")
PUBLIC_HEALTH_PATHS = {"/healthz", "/health/observability"}


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    settings = get_settings()
    if request.url.path in PUBLIC_HEALTH_PATHS:
        return await call_next(request)
    if not settings.api_key:
        return await call_next(request)

    auth_header = request.headers.get("authorization", "")
    bearer_token = auth_header.removeprefix("Bearer ").strip()
    configured_header = request.headers.get(settings.api_key_header_name)
    if bearer_token != settings.api_key and configured_header != settings.api_key:
        return JSONResponse(
            {"detail": "Invalid or missing API key"},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return await call_next(request)


settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials="*" not in settings.allowed_origins,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)

app.include_router(openai_router, prefix="/v1")
app.include_router(follow_ups_router, prefix="/v1")


@app.get("/healthz")
async def healthz(settings: Settings = Depends(get_settings)):
    return {"status": "healthy", "model": settings.public_model_name}


@app.get("/health/observability")
async def observability_health():
    return {"status": "healthy", "observability": get_observability().status()}


@app.on_event("shutdown")
def flush_observability():
    get_observability().flush()
