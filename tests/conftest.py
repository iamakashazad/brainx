from __future__ import annotations

import asyncio
import io
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.core import database, queue as queue_manager  # noqa: E402
from backend.core.config import settings  # noqa: E402
from backend.main import create_app  # noqa: E402
from backend.models.job import Base  # noqa: E402
from backend.models import content as _content  # noqa: E402,F401
from backend.models import persona as _persona  # noqa: E402,F401
from backend.models.schemas import PersonaRead  # noqa: E402


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch) -> AsyncClient:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"
    test_engine = create_async_engine(db_url, echo=False)
    test_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    monkeypatch.setattr(settings, "database_url", db_url)
    monkeypatch.setattr(settings, "uploads_dir", tmp_path / "uploads")
    monkeypatch.setattr(database, "engine", test_engine)
    monkeypatch.setattr(database, "async_session", test_session)
    monkeypatch.setattr(queue_manager, "gpu_queue", asyncio.Queue())

    async def fake_load_model(*_args, **_kwargs):
        return object()

    async def fake_text_inference(_text: str) -> np.ndarray:
        return np.ones((2, 8))

    async def fake_video_inference(_path: str) -> np.ndarray:
        return np.zeros((2, 8))

    monkeypatch.setattr("backend.main.load_model", fake_load_model)
    monkeypatch.setattr(queue_manager, "run_tribev2_text", fake_text_inference)
    monkeypatch.setattr(queue_manager, "run_tribev2_video", fake_video_inference)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    app = create_app()

    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
            yield http_client

    await test_engine.dispose()


@pytest.fixture
def client_factory():
    return client


@pytest.fixture
def sample_jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (300, 200), color=(200, 30, 30)).save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture
def sample_jpeg_with_exif():
    def _make(orientation: int = 1, size: tuple[int, int] = (3000, 2000)) -> bytes:
        buf = io.BytesIO()
        img = Image.new("RGB", size, color=(80, 80, 200))
        exif = img.getexif()
        exif[274] = orientation
        img.save(buf, format="JPEG", quality=90, exif=exif.tobytes())
        return buf.getvalue()

    return _make


@pytest_asyncio.fixture
async def persona_fixture(client: AsyncClient) -> str:
    payload: dict[str, Any] = {
        "name": "Test Persona",
        "demographics": {"age": 32, "role": "marketing manager", "background": None},
        "psychographics": {
            "goals": ["find a plan"],
            "values": ["speed"],
            "motivations": ["efficiency"],
        },
        "cognitive_state": {
            "attention_span": "medium",
            "stress_level": "moderate",
            "tech_literacy": "intermediate",
        },
        "environment": {"device": "desktop", "location": "office", "ambient": None},
    }
    response = await client.post("/personas", json=payload)
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


@pytest_asyncio.fixture
async def persona_model_fixture(client: AsyncClient, persona_fixture: str) -> PersonaRead:
    """Return a serializable persona model for recommendation service tests."""
    response = await client.get(f"/personas/{persona_fixture}")
    assert response.status_code == 200, response.text
    return PersonaRead.model_validate(response.json())


@pytest_asyncio.fixture
async def text_content_fixture(client: AsyncClient) -> str:
    response = await client.post("/content/text", json={"content_text": "Buy our product today."})
    assert response.status_code in (200, 201), response.text
    return response.json()["content_id"]


@pytest_asyncio.fixture
async def ui_screens_fixture(client: AsyncClient, sample_jpeg_bytes: bytes) -> str:
    files = [("files", (f"screen_{i}.jpg", sample_jpeg_bytes, "image/jpeg")) for i in range(3)]
    response = await client.post("/content/screens", files=files)
    assert response.status_code in (200, 201), response.text
    return response.json()["content_id"]


@pytest_asyncio.fixture
async def static_content_fixture(client: AsyncClient, sample_jpeg_bytes: bytes) -> str:
    response = await client.post(
        "/content/static",
        files={"file": ("ad.jpg", sample_jpeg_bytes, "image/jpeg")},
    )
    assert response.status_code in (200, 201), response.text
    return response.json()["content_id"]


@pytest.fixture
def respx_mock_phase2():
    import respx

    with respx.mock(assert_all_called=False) as router:
        yield router


@pytest.fixture
def deepseek_mock_ok(respx_mock_phase2):
    import httpx
    import json

    valid = {
        "screens": [
            {
                "screen_index": 0,
                "narrative_text": "The user reads the heading and scrolls.",
                "summary_emotional_state": "curious",
                "memorability_hypothesis": "high",
                "events": [
                    {
                        "timestamp_ms": 0,
                        "type": "fixation",
                        "target_region": {
                            "x_ratio": 0.5,
                            "y_ratio": 0.2,
                            "width_ratio": 0.3,
                            "height_ratio": 0.1,
                        },
                        "intensity": 0.8,
                        "note": "headline",
                    }
                ],
            }
        ]
    }
    respx_mock_phase2.post("https://api.deepseek.com/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(valid)}}]},
        )
    )
    return respx_mock_phase2


@pytest.fixture
def deepseek_mock_hallucinate(respx_mock_phase2):
    import httpx
    import json

    hallucinated = {
        "hallucinations": [
            {
                "screen_index": 0,
                "narrative_claim": "Submit order button",
                "reason": "not visible",
            }
        ],
        "verified_elements": [],
    }
    respx_mock_phase2.post("https://api.deepseek.com/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(hallucinated)}}]},
        )
    )
    return respx_mock_phase2
