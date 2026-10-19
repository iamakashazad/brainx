from __future__ import annotations

import httpx

_BODY_LIMIT = 300


def provider_error_message(provider: str, exc: Exception, *, secrets: tuple[str, ...] = ()) -> str:
    """Turn a provider HTTP failure into a job/HTTP error message.

    The response body is kept (truncated): it is where the actionable reason
    lives — DeepSeek's 402 "Insufficient Balance", Replicate's 422 input-schema
    complaint — and dropping it left only "HTTP 4xx. Please retry.". Any
    configured secret is scrubbed in case a provider echoes it back.
    """
    if isinstance(exc, httpx.HTTPStatusError):
        message = f"{provider} request failed (HTTP {exc.response.status_code})"
        try:
            body = exc.response.text.strip()
        except Exception:  # streaming/undecodable body: status code is still useful
            body = ""
        for secret in secrets:
            if secret:
                body = body.replace(secret, "[redacted]")
        if body:
            if len(body) > _BODY_LIMIT:
                body = body[:_BODY_LIMIT] + "…"
            message = f"{message}: {body}"
        return message
    if isinstance(exc, httpx.TimeoutException):
        return f"{provider} request timed out. Please retry."
    if isinstance(exc, httpx.HTTPError):
        return f"Could not reach {provider} (network error). Please retry."
    return f"{provider} request failed: {exc}"
