from __future__ import annotations

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from backend.core import database
from backend.core.config import settings
from backend.models.content import Content, ContentType
from backend.models.schemas import ContentCreated, TextContentRequest
from backend.services.content_processing import ImageValidationError, process_upload

router = APIRouter()


@router.post("/text", response_model=ContentCreated, status_code=status.HTTP_201_CREATED)
async def create_text_content(payload: TextContentRequest) -> ContentCreated:
    content_id = str(uuid.uuid4())
    row = Content(
        id=content_id,
        content_type=ContentType.TEXT.value,
        screen_count=None,
        content_text=payload.content_text,
        meta_json=None,
    )
    async with database.async_session() as session:
        session.add(row)
        await session.commit()
    return ContentCreated(content_id=content_id, content_type=ContentType.TEXT.value)


@router.post("/screens", response_model=ContentCreated, status_code=status.HTTP_201_CREATED)
async def create_ui_screens(files: list[UploadFile] = File(...)) -> ContentCreated:
    if not 1 <= len(files) <= 5:
        raise HTTPException(status_code=400, detail="ui_screens requires 1-5 images")

    content_id = str(uuid.uuid4())
    target_dir = settings.uploads_dir / content_id
    per_file_meta: list[dict] = []
    for index, upload in enumerate(files, start=1):
        raw = await upload.read()
        try:
            meta = process_upload(raw, target_dir / f"screen_{index}.jpg")
        except ImageValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        per_file_meta.append({**meta, "original_filename": upload.filename, "index": index})

    row = Content(
        id=content_id,
        content_type=ContentType.UI_SCREENS.value,
        screen_count=len(files),
        content_text=None,
        meta_json={"files": per_file_meta},
    )
    async with database.async_session() as session:
        session.add(row)
        await session.commit()
    return ContentCreated(content_id=content_id, content_type=ContentType.UI_SCREENS.value)


@router.post("/static", response_model=ContentCreated, status_code=status.HTTP_201_CREATED)
async def create_static_content(file: UploadFile = File(...)) -> ContentCreated:
    content_id = str(uuid.uuid4())
    target_dir = settings.uploads_dir / content_id
    raw = await file.read()
    try:
        meta = process_upload(raw, target_dir / "image.jpg")
    except ImageValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    row = Content(
        id=content_id,
        content_type=ContentType.STATIC.value,
        screen_count=1,
        content_text=None,
        meta_json={"files": [{**meta, "original_filename": file.filename, "index": 1}]},
    )
    async with database.async_session() as session:
        session.add(row)
        await session.commit()
    return ContentCreated(content_id=content_id, content_type=ContentType.STATIC.value)
