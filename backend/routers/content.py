from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from backend.core import database
from backend.core.config import settings
from backend.models.content import Content, ContentType
from backend.models.schemas import ContentCreated, TextContentRequest
from backend.services.content_processing import MAX_INPUT_BYTES, ImageValidationError, process_upload

router = APIRouter()


async def _process(upload: UploadFile, out_path) -> dict:
    # Read one byte past the cap so oversize is still detected without buffering
    # an arbitrarily large body, and decode/resize off the event loop — PIL work
    # on 5 screens used to stall every poll and worker DB write for seconds.
    raw = await upload.read(MAX_INPUT_BYTES + 1)
    try:
        return await asyncio.to_thread(process_upload, raw, out_path)
    except ImageValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
        meta = await _process(upload, target_dir / f"screen_{index}.jpg")
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
    meta = await _process(file, target_dir / "image.jpg")

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
