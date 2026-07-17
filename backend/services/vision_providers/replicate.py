from __future__ import annotations

import asyncio
import base64
import json
import logging
from pathlib import Path

import httpx

from backend.core.config import settings
from backend.models.simulation import DeepSeekClientError

logger = logging.getLogger(__name__)

REPLICATE_BASE = "https://api.replicate.com"
MISSING_TOKEN_ERROR = (
    "REPLICATE_API_TOKEN is not configured. Set it in .env and restart the backend."
)


def _http_error_message(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"Replicate request failed (HTTP {exc.response.status_code}). Please retry."
    if isinstance(exc, httpx.TimeoutException):
        return "Replicate request timed out. Please retry."
    if isinstance(exc, httpx.HTTPError):
        return "Could not reach Replicate (network error). Please retry."
    return f"Vision analysis failed: {exc}"


_version_cache: dict[str, str] = {}


class ReplicateVL2Backend:
    async def _resolve_version(self, client: httpx.AsyncClient) -> str:
        """Community models require a version hash on /v1/predictions."""
        slug = settings.vision_model
        cached = _version_cache.get(slug)
        if cached:
            return cached

        response = await client.get(
            f"{REPLICATE_BASE}/v1/models/{slug}",
            headers={"Authorization": f"Bearer {settings.replicate_api_token}"},
        )
        response.raise_for_status()
        version = (response.json().get("latest_version") or {}).get("id")
        if not version:
            raise DeepSeekClientError(
                f"Replicate model {slug} has no published version to run."
            )
        _version_cache[slug] = version
        return version

    async def analyze(
        self,
        images: list[Path],
        prompt: str,
        schema_hint: dict | None = None,
        max_tokens: int = 4000,
        temperature: float = 0.6,
    ) -> dict | str:
        if not settings.replicate_api_token:
            raise DeepSeekClientError(MISSING_TOKEN_ERROR)

        full_prompt = prompt
        if schema_hint is not None:
            full_prompt = (
                f"{prompt}\n\nReturn ONLY valid JSON matching this schema "
                f"(no prose, no markdown fences):\n{json.dumps(schema_hint)}"
            )

        try:
            encoded_images = await asyncio.to_thread(
                lambda: [
                    "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode("utf-8")
                    for path in images
                ]
            )
            async with httpx.AsyncClient(timeout=120.0) as client:
                version = await self._resolve_version(client)
                # deepseek-vl2 accepts a single `image` input plus
                # `max_length_tokens` (not max_new_tokens); unknown keys are
                # rejected. Multi-screen callers get first-image analysis.
                payload = {
                    "version": version,
                    "input": {
                        "image": encoded_images[0] if encoded_images else None,
                        "prompt": full_prompt,
                        "max_length_tokens": max_tokens,
                        "temperature": temperature,
                    },
                }
                response = await client.post(
                    f"{REPLICATE_BASE}/v1/predictions",
                    headers={"Authorization": f"Bearer {settings.replicate_api_token}"},
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                output = await self._resolve_output(client, data)
        except (httpx.HTTPError, OSError, ValueError, KeyError) as exc:
            logger.error("Replicate request failed", exc_info=exc)
            raise DeepSeekClientError(_http_error_message(exc)) from exc

        if isinstance(output, dict):
            return output
        return "".join(output) if isinstance(output, list) else str(output)

    async def _resolve_output(self, client: httpx.AsyncClient, data: dict) -> str | list[str]:
        # The creation response carries "output": null while the prediction is
        # still starting — only short-circuit once output actually exists.
        if data.get("output") is not None:
            return data["output"]

        get_url = data["urls"]["get"]
        for _ in range(60):
            poll = await client.get(
                get_url,
                headers={"Authorization": f"Bearer {settings.replicate_api_token}"},
            )
            poll.raise_for_status()
            status_payload = poll.json()
            status = status_payload.get("status")
            if status in {"succeeded", "failed", "canceled"}:
                if status != "succeeded":
                    detail = status_payload.get("error") or status
                    raise DeepSeekClientError(f"Replicate prediction {status}: {detail}")
                return status_payload["output"]
            await asyncio.sleep(2)
        raise DeepSeekClientError("Replicate prediction timed out after ~120s of polling.")
