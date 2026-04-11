from __future__ import annotations

from fastapi import APIRouter, Request

from backend.core.config import settings
from backend.models.schemas import ModelStatusResponse

router = APIRouter()


@router.get("/model-status", response_model=ModelStatusResponse)
async def model_status(request: Request) -> ModelStatusResponse:
    loaded = getattr(request.app.state, "tribe_model", None) is not None
    status = "ready" if loaded else "error"
    return ModelStatusResponse(loaded=loaded, device=settings.device, status=status)
