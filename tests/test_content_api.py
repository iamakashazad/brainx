from __future__ import annotations

from pathlib import Path

import pytest

from backend.core.config import settings

pytestmark = pytest.mark.asyncio


async def test_ui_screens_single(client, sample_jpeg_bytes):
    files = [("files", ("a.jpg", sample_jpeg_bytes, "image/jpeg"))]
    response = await client.post("/content/screens", files=files)
    assert response.status_code == 201, response.text
    content_id = response.json()["content_id"]
    target = Path(settings.uploads_dir) / content_id / "screen_1.jpg"
    assert target.exists() and target.stat().st_size > 0


async def test_ui_screens_five(client, sample_jpeg_bytes):
    files = [("files", (f"s{i}.jpg", sample_jpeg_bytes, "image/jpeg")) for i in range(5)]
    response = await client.post("/content/screens", files=files)
    assert response.status_code == 201, response.text
    content_id = response.json()["content_id"]
    for index in range(1, 6):
        assert (Path(settings.uploads_dir) / content_id / f"screen_{index}.jpg").exists()


async def test_ui_screens_too_many(client, sample_jpeg_bytes):
    files = [("files", (f"s{i}.jpg", sample_jpeg_bytes, "image/jpeg")) for i in range(6)]
    response = await client.post("/content/screens", files=files)
    assert response.status_code == 400


async def test_ui_screens_zero(client):
    response = await client.post("/content/screens", files=[])
    assert response.status_code in (400, 422)


async def test_static_happy(client, sample_jpeg_bytes):
    response = await client.post(
        "/content/static",
        files={"file": ("ad.jpg", sample_jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code == 201
    content_id = response.json()["content_id"]
    assert (Path(settings.uploads_dir) / content_id / "image.jpg").exists()


async def test_text_happy(client):
    response = await client.post("/content/text", json={"content_text": "Try our new product"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_type"] == "text"
    assert body["content_id"]
    assert not (Path(settings.uploads_dir) / body["content_id"]).exists()


async def test_mime_spoofing_rejected(client):
    bogus = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 200
    files = [("files", ("malware.jpg", bogus, "image/jpeg"))]
    response = await client.post("/content/screens", files=files)
    assert response.status_code == 400
    assert "MIME" in response.text or "unsupported" in response.text.lower()


async def test_oversize_rejected(client):
    huge = b"\x00" * (5 * 1024 * 1024 + 1024)
    files = [("files", ("big.jpg", huge, "image/jpeg"))]
    response = await client.post("/content/screens", files=files)
    assert response.status_code == 400
