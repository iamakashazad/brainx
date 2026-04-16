from __future__ import annotations

import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from backend.core.config import settings
from backend.models.simulation import DeepSeekClientError, SchemaValidationFailure

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)
SANITIZED_ERROR = "Simulation service temporarily unavailable. Please retry."


async def deepseek_text_completion(
    system: str,
    user: str,
    response_model: type[T],
    model: str | None = None,
    max_tokens: int = 4000,
    temperature: float = 0.6,
) -> T:
    model = model or settings.deepseek_text_model
    current_user = user

    for attempt in (1, 2):
        try:
            if not settings.deepseek_api_key:
                raise DeepSeekClientError(SANITIZED_ERROR)
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{settings.deepseek_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": current_user},
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("DeepSeek request failed", exc_info=exc)
            raise DeepSeekClientError(SANITIZED_ERROR) from exc

        raw = response.json()["choices"][0]["message"]["content"] or ""
        try:
            return response_model.model_validate_json(raw)
        except ValidationError as exc:
            if attempt == 1:
                current_user = (
                    f"Previous attempt failed validation:\n{exc}\n\n"
                    f"Resend valid JSON. Same content as before:\n{user}"
                )
                continue
            raise SchemaValidationFailure(f"DeepSeek schema validation failed twice: {exc}") from exc

    raise SchemaValidationFailure("DeepSeek schema validation failed twice")
