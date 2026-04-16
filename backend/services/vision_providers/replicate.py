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
SANITIZED_ERROR = "Simulation service temporarily unavailable. Please retry."


class ReplicateVL2Backend:
    async def analyze(
        self,
        images: list[Path],
        prompt: str,
        schema_hint: dict | None = None,
        max_tokens: int = 4000,
        temperature: float = 0.6,
    ) -> dict | str:
        if not settings.replicate_api_token:
            raise DeepSeekClientError(SANITIZED_ERROR)

        full_prompt = prompt
        if schema_hint is not None:
            full_prompt = (
                f"{prompt}\n\nReturn ONLY valid JSON matching this schema "
                f"(no prose, no markdown fences):\n{json.dumps(schema_hint)}"
            )

        try:
            encoded_images = [
                "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode("utf-8")
                for path in images
            ]
            payload = {
                "version": settings.vision_model,
                "input": {
                    "image": encoded_images[0] if encoded_images else None,
                    "images": encoded_images,
                    "prompt": full_prompt,
                    "max_new_tokens": max_tokens,
                    "temperature": temperature,
                },
            }
            async with httpx.AsyncClient(timeout=120.0) as client:
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
            raise DeepSeekClientError(SANITIZED_ERROR) from exc

        if isinstance(output, dict):
            return output
        return "".join(output) if isinstance(output, list) else str(output)

    async def _resolve_output(self, client: httpx.AsyncClient, data: dict) -> str | list[str]:
        if "output" in data:
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
                    raise DeepSeekClientError(SANITIZED_ERROR)
                return status_payload["output"]
            await asyncio.sleep(2)
        raise DeepSeekClientError(SANITIZED_ERROR)
