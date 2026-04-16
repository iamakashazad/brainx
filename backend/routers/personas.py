from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from backend.core import database
from backend.models.persona import Persona
from backend.models.schemas import PersonaCreate, PersonaRead, PersonaUpdate

router = APIRouter()


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
