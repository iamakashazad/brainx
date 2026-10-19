from __future__ import annotations

import datetime as dt
from typing import get_args

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.core import database
from backend.core.config import settings
from backend.models.persona import CognitiveStateModel, EnvironmentModel, Persona
from backend.models.schemas import PersonaCreate, PersonaRead, PersonaUpdate
from backend.models.simulation import DeepSeekClientError, SchemaValidationFailure

router = APIRouter()

# ── AI suggest ────────────────────────────────────────────────────────────────

class AISuggestRequest(PydanticBaseModel):
    name: str
    age: int
    role: str
    background: str | None = None
    field: str


class _ListSuggestion(PydanticBaseModel):
    value: list[str]


class _StrSuggestion(PydanticBaseModel):
    value: str


class AISuggestResponse(PydanticBaseModel):
    value: str | list[str]


_FIELD_IS_LIST = {
    "psychographics.goals",
    "psychographics.values",
    "psychographics.motivations",
}

# Fields backed by a Literal on the persona model. The LLM's answer is free text,
# so it is normalised and checked against the model's own choices — otherwise a
# reply like "Medium" fills the <select> with a value it has no option for and
# the persona save later fails validation with nothing shown on that step.
_FIELD_CHOICES: dict[str, tuple[str, ...]] = {
    f"{prefix}.{name}": get_args(model.model_fields[name].annotation)
    for prefix, model, names in (
        ("cognitive_state", CognitiveStateModel, ("attention_span", "stress_level", "tech_literacy")),
        ("environment", EnvironmentModel, ("device", "location")),
    )
    for name in names
}

_FIELD_PROMPTS: dict[str, str] = {
    "psychographics.goals": (
        'Suggest 3–5 concise professional/personal goals. Return JSON: {"value": ["goal1", ...]}'
    ),
    "psychographics.values": (
        'Suggest 3–5 core values this persona holds. Return JSON: {"value": ["value1", ...]}'
    ),
    "psychographics.motivations": (
        'Suggest 3–5 key motivations. Return JSON: {"value": ["motivation1", ...]}'
    ),
    "cognitive_state.attention_span": (
        "Choose attention span: short, medium, or long. "
        'Return JSON: {"value": "medium"}'
    ),
    "cognitive_state.stress_level": (
        "Choose stress level: low, moderate, or high. "
        'Return JSON: {"value": "moderate"}'
    ),
    "cognitive_state.tech_literacy": (
        "Choose tech literacy: novice, intermediate, or expert. "
        'Return JSON: {"value": "intermediate"}'
    ),
    "environment.device": (
        "Choose primary device: mobile, tablet, or desktop. "
        'Return JSON: {"value": "desktop"}'
    ),
    "environment.location": (
        "Choose typical location: commute, home, office, store, or other. "
        'Return JSON: {"value": "office"}'
    ),
    "environment.ambient": (
        "Describe the ambient environment in one short phrase (noise, setting). "
        'Return JSON: {"value": "Quiet home office, minimal distractions"}'
    ),
}

_SYSTEM_PROMPT = (
    "You are an expert UX researcher. Given basic persona demographics, suggest realistic "
    "attribute values. Respond with valid JSON only — no explanation, no markdown."
)


@router.post("/ai-suggest", response_model=AISuggestResponse)
async def ai_suggest_persona_field(payload: AISuggestRequest) -> AISuggestResponse:
    from backend.services.deepseek_client import deepseek_text_completion

    if payload.field not in _FIELD_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown field: {payload.field}")

    # Mirror /analyze: a missing key is a 422 with an actionable detail, not a
    # provider call that escapes as a plain-text 500 with no body the UI can show.
    if not settings.deepseek_api_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "DEEPSEEK_API_KEY is not configured on the server. "
                "Add it to .env and restart the backend."
            ),
        )

    ctx_lines = [
        f"Persona name: {payload.name}",
        f"Age: {payload.age}",
        f"Role: {payload.role}",
    ]
    if payload.background:
        ctx_lines.append(f"Background: {payload.background}")
    context = "\n".join(ctx_lines)
    user_prompt = f"{context}\n\n{_FIELD_PROMPTS[payload.field]}"

    schema = _ListSuggestion if payload.field in _FIELD_IS_LIST else _StrSuggestion
    try:
        result = await deepseek_text_completion(_SYSTEM_PROMPT, user_prompt, schema)
    except SchemaValidationFailure as exc:
        # The provider answered but not in the shape we asked for. 502 rather
        # than 500: the fault is upstream, and the detail is worth showing.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI suggestion returned an unusable response: {exc}",
        ) from exc
    except DeepSeekClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    choices = _FIELD_CHOICES.get(payload.field)
    if choices is not None:
        normalised = str(result.value).strip().strip(".").lower()
        if normalised not in choices:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"AI suggestion {result.value!r} is not one of: {', '.join(choices)}. "
                    "Please retry or pick a value."
                ),
            )
        return AISuggestResponse(value=normalised)
    return AISuggestResponse(value=result.value)


# ── CRUD ──────────────────────────────────────────────────────────────────────

def _serialize(persona: Persona) -> PersonaRead:
    return PersonaRead(
        id=persona.id,
        name=persona.name,
        demographics=persona.demographics,
        psychographics=persona.psychographics,
        cognitive_state=persona.cognitive_state,
        environment=persona.environment,
        created_at=persona.created_at.isoformat(),
        updated_at=persona.updated_at.isoformat(),
    )


@router.post("", response_model=PersonaRead, status_code=status.HTTP_201_CREATED)
async def create_persona(payload: PersonaCreate) -> PersonaRead:
    persona = Persona(
        name=payload.name,
        demographics=payload.demographics.model_dump(),
        psychographics=payload.psychographics.model_dump(),
        cognitive_state=payload.cognitive_state.model_dump(),
        environment=payload.environment.model_dump(),
    )
    async with database.async_session() as session:
        session.add(persona)
        await session.commit()
        await session.refresh(persona)
    return _serialize(persona)


@router.get("", response_model=list[PersonaRead])
async def list_personas() -> list[PersonaRead]:
    async with database.async_session() as session:
        result = await session.execute(select(Persona).order_by(Persona.created_at.desc()))
        personas = result.scalars().all()
    return [_serialize(persona) for persona in personas]


@router.get("/{persona_id}", response_model=PersonaRead)
async def get_persona(persona_id: str) -> PersonaRead:
    async with database.async_session() as session:
        result = await session.execute(select(Persona).where(Persona.id == persona_id))
        persona = result.scalar_one_or_none()
    if persona is None:
        raise HTTPException(status_code=404, detail=f"Persona {persona_id} not found")
    return _serialize(persona)


@router.patch("/{persona_id}", response_model=PersonaRead)
async def update_persona(persona_id: str, payload: PersonaUpdate) -> PersonaRead:
    async with database.async_session() as session:
        result = await session.execute(select(Persona).where(Persona.id == persona_id))
        persona = result.scalar_one_or_none()
        if persona is None:
            raise HTTPException(status_code=404, detail=f"Persona {persona_id} not found")
        if payload.name is not None:
            persona.name = payload.name
        if payload.demographics is not None:
            persona.demographics = payload.demographics.model_dump()
        if payload.psychographics is not None:
            persona.psychographics = payload.psychographics.model_dump()
        if payload.cognitive_state is not None:
            persona.cognitive_state = payload.cognitive_state.model_dump()
        if payload.environment is not None:
            persona.environment = payload.environment.model_dump()
        persona.updated_at = dt.datetime.utcnow()
        await session.commit()
        await session.refresh(persona)
    return _serialize(persona)


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_persona(persona_id: str) -> Response:
    async with database.async_session() as session:
        result = await session.execute(select(Persona).where(Persona.id == persona_id))
        persona = result.scalar_one_or_none()
        if persona is None:
            raise HTTPException(status_code=404, detail=f"Persona {persona_id} not found")
        try:
            await session.delete(persona)
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Persona is still referenced by existing analyze jobs",
            ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
