from app.api.v1.deps import get_onboarding_repository
from app.schemas.onboarding import RoleSelectionRequest
from app.services.clients.database.onboarding_repository import OnboardingRepository
from fastapi import APIRouter, Depends, Request, status

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    # Cloud Run sets X-Forwarded-For; the first entry is the original client.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else None


@router.post("/role", status_code=status.HTTP_204_NO_CONTENT)
async def record_role_selection(
    payload: RoleSelectionRequest,
    request: Request,
    repo: OnboardingRepository = Depends(get_onboarding_repository),
) -> None:
    """Persist a welcome-modal role selection with the requester's IP and UA."""
    await repo.insert_role_selection(
        role=payload.role.value,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
