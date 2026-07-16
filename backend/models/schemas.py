from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field

from backend.models.persona import (
    CognitiveStateModel,
    DemographicsModel,
    EnvironmentModel,
    PsychographicsModel,
)


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
    persona_id: Optional[str] = None
    queue_position: Optional[int] = None
    stage: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    runtime_seconds: Optional[int] = None
    inference_processes: int = 0
    stale_inference_processes: int = 0
    status_message: Optional[str] = None


class JobSummary(BaseModel):
    job_id: str
    status: str
    persona_id: Optional[str] = None
    created_at: Optional[str] = None


class ModelStatusResponse(BaseModel):
    loaded: bool
    device: str
    status: str


class PersonaCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    demographics: DemographicsModel
    psychographics: PsychographicsModel
    cognitive_state: CognitiveStateModel
    environment: EnvironmentModel


class PersonaUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    demographics: Optional[DemographicsModel] = None
    psychographics: Optional[PsychographicsModel] = None
    cognitive_state: Optional[CognitiveStateModel] = None
    environment: Optional[EnvironmentModel] = None


class PersonaRead(BaseModel):
    id: str
    name: str
    demographics: DemographicsModel
    psychographics: PsychographicsModel
    cognitive_state: CognitiveStateModel
    environment: EnvironmentModel
    created_at: str
    updated_at: str


class TextContentRequest(BaseModel):
    content_text: str = Field(min_length=1, max_length=20000)


class ContentCreated(BaseModel):
    content_id: str
    content_type: str


class AnalyzeRequest(BaseModel):
    persona_id: str = Field(min_length=1)
    content_id: str = Field(min_length=1)


class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
