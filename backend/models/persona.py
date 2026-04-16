from __future__ import annotations

import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, JSON, String

from backend.models.job import Base


class DemographicsModel(BaseModel):
    age: int = Field(ge=0, le=120)
    role: str = Field(min_length=1, max_length=80)
    background: str | None = Field(default=None, max_length=500)


class PsychographicsModel(BaseModel):
    goals: list[str] = Field(default_factory=list)
    values: list[str] = Field(default_factory=list)
    motivations: list[str] = Field(default_factory=list)


class CognitiveStateModel(BaseModel):
    attention_span: Literal["short", "medium", "long"]
    stress_level: Literal["low", "moderate", "high"]
    tech_literacy: Literal["novice", "intermediate", "expert"]


class EnvironmentModel(BaseModel):
    device: Literal["mobile", "tablet", "desktop"]
    location: Literal["commute", "home", "office", "store", "other"]
    ambient: str | None = None


class Persona(Base):
    __tablename__ = "personas"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    demographics = Column(JSON, nullable=False)
    psychographics = Column(JSON, nullable=False)
    cognitive_state = Column(JSON, nullable=False)
    environment = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=dt.datetime.utcnow,
        onupdate=dt.datetime.utcnow,
        nullable=False,
    )
