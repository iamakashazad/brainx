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

pytest_plugins = ("tests.fixtures.sim_log_3_screens",)

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.core import database, queue as queue_manager  # noqa: E402
from backend.core.config import settings  # noqa: E402
from backend.main import create_app  # noqa: E402
from backend.models.job import Base  # noqa: E402
from backend.models import content as _content  # noqa: E402,F401
from backend.models import persona as _persona  # noqa: E402,F401
from backend.models.recommendations import Recommendations  # noqa: E402
from backend.models.job import Job  # noqa: E402
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
def mixed_recommendations_payload() -> dict[str, Any]:
    return {
        "recommendations": [
            {
                "rec_type": "layout_flag",
                "screen_index": 0,
                "evidence": {
                    "circuit": "Cognitive Load",
                    "region": "G_front_middle",
                    "activation_score": 84.0,
                    "score_rank": "Very High",
                },
                "target_region": {
                    "x_ratio": 0.15,
                    "y_ratio": 0.32,
                    "width_ratio": 0.55,
                    "height_ratio": 0.12,
                },
                "element_description": "Subtitle reread",
                "rationale": "The reread pattern shows the screen is overloading working memory.",
            },
            {
                "rec_type": "memorability",
                "screen_index": 1,
                "evidence": {
                    "circuit": "Memory Encoding",
                    "region": "G_oc-temp_med-Parahip",
                    "activation_score": 18.0,
                    "score_rank": "Low",
                },
                "rationale": "This screen is likely to be forgotten unless the value prop is isolated.",
            },
            {
                "rec_type": "emotional_dropoff",
                "screen_index": 2,
                "evidence": {
                    "circuit": "Emotional Response",
                    "region": "S_cingul-Marginalis",
                    "activation_score": 21.0,
                    "score_rank": "Low",
                },
                "rationale": "Emotional engagement drops on pricing and needs a confidence repair.",
            },
        ]
    }


@pytest.fixture
def stub_queue_recommendations(monkeypatch: pytest.MonkeyPatch):
    def _install(payload: dict[str, Any]) -> dict[str, Any]:
        async def fake_generate_recommendations(*_args, **_kwargs) -> Recommendations:
            return Recommendations.model_validate(payload)

        monkeypatch.setattr(queue_manager, "generate_recommendations", fake_generate_recommendations)
        return payload

    return _install


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


@pytest_asyncio.fixture
async def seed_done_job(tmp_path: Path):
    async def _seed(
        *,
        screen_count: int = 1,
        job_id: str = "job-done",
    ) -> tuple[str, Path, np.ndarray]:
        job_dir = tmp_path / "activations" / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        manifest: list[dict[str, object]] = []
        first_array: np.ndarray | None = None
        first_path: Path | None = None

        for screen_index in range(screen_count):
            raw = (
                np.arange(4 * 20484, dtype=np.float32).reshape(4, 20484)
                + np.float32(screen_index * 0.25)
            )
            path = job_dir / f"screen_{screen_index + 1}.npy"
            np.save(path, raw)
            manifest.append(
                {
                    "screen_index": screen_index,
                    "path": path.as_posix(),
                    "shape": list(raw.shape),
                    "timesteps": int(raw.shape[0]),
                }
            )
            if first_array is None:
                first_array = raw
                first_path = path

        envelope = {
            "schema_version": 1,
            "simulation": {},
            "overlays": [],
            "activations": manifest,
            "roi": [],
            "flow_continuity": {"circuits": {}},
            "recommendations": [],
            "pathway": {
                "selected_pathway": "text",
                "slideshow_path": None,
                "durations": [],
            },
        }

        async with database.async_session() as session:
            session.add(
                Job(
                    id=job_id,
                    status="DONE",
                    result_json=envelope,
                    input_type="text",
                )
            )
            await session.commit()

        assert first_array is not None
        assert first_path is not None
        return job_id, first_path, first_array

    return _seed


@pytest_asyncio.fixture
async def seed_pending_job():
    async def _seed(*, job_id: str = "job-pending") -> str:
        async with database.async_session() as session:
            session.add(
                Job(
                    id=job_id,
                    status="PENDING",
                    input_type="text",
                )
            )
            await session.commit()

        return job_id

    return _seed
