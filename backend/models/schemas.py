from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class TestInferenceRequest(BaseModel):
    text: str = Field(..., min_length=1)
    input_type: str = "text"


class TestInferenceResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    queue_position: Optional[int] = None
    stage: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[str] = None


class ModelStatusResponse(BaseModel):
    loaded: bool
    device: str
    status: str
