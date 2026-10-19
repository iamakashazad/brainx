from __future__ import annotations

import httpx

from backend.services.http_errors import provider_error_message


def _status_error(status: int, body: str) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://api.example.test/v1")
    response = httpx.Response(status, request=request, text=body)
    return httpx.HTTPStatusError("boom", request=request, response=response)


def test_status_error_keeps_provider_reason():
    message = provider_error_message("DeepSeek", _status_error(402, '{"error":"Insufficient Balance"}'))
    assert "HTTP 402" in message
    assert "Insufficient Balance" in message


def test_status_error_redacts_secrets_and_truncates():
    body = "bad key sk-secret-123 " + "x" * 1000
    message = provider_error_message("DeepSeek", _status_error(401, body), secrets=("sk-secret-123",))
    assert "sk-secret-123" not in message
    assert "[redacted]" in message
    assert len(message) < 400


def test_timeout_message():
    assert "timed out" in provider_error_message("Replicate", httpx.ReadTimeout("slow"))
