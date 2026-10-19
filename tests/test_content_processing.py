from __future__ import annotations

import io
from pathlib import Path

import pytest
from PIL import Image

from backend.services.content_processing import ImageValidationError, MAX_INPUT_BYTES, process_upload


def _make_jpeg(size: tuple[int, int], orientation: int | None = None) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=(80, 80, 200))
    if orientation is not None:
        exif = img.getexif()
        exif[274] = orientation
        img.save(buf, format="JPEG", quality=90, exif=exif.tobytes())
    else:
        img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_pillow_pipeline(tmp_path: Path) -> None:
    raw = _make_jpeg((3000, 2000), orientation=6)
    assert len(raw) <= MAX_INPUT_BYTES
    out = tmp_path / "screen_1.jpg"
    meta = process_upload(raw, out)
    assert max(meta["width"], meta["height"]) == 1024
    assert out.exists() and out.stat().st_size > 0
    with Image.open(out) as reopened:
        exif = reopened.getexif()
        assert exif.get(274) in (None, 1)


def test_oversize_raises(tmp_path: Path) -> None:
    raw = b"\x00" * (MAX_INPUT_BYTES + 1)
    with pytest.raises(ImageValidationError, match="> 5MB"):
        process_upload(raw, tmp_path / "x.jpg")


def test_mime_spoof_raises(tmp_path: Path) -> None:
    raw = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00" + b"\x00" * 200
    with pytest.raises(ImageValidationError, match="unsupported MIME"):
        process_upload(raw, tmp_path / "x.jpg")


def test_empty_raises(tmp_path: Path) -> None:
    with pytest.raises(ImageValidationError, match="empty"):
        process_upload(b"", tmp_path / "x.jpg")


@pytest.mark.filterwarnings("ignore::PIL.Image.DecompressionBombWarning")
def test_huge_dimensions_are_refused_before_decode(tmp_path: Path) -> None:
    """A tiny 1-bit PNG with enormous dimensions must not be decoded to RGB."""
    from io import BytesIO

    from PIL import Image

    from backend.services.content_processing import MAX_DECODED_PIXELS

    buf = BytesIO()
    Image.new("1", (8000, 8000)).save(buf, format="PNG")  # 64 MP, a few KB on disk
    raw = buf.getvalue()
    assert len(raw) < 1024 * 1024
    assert 8000 * 8000 > MAX_DECODED_PIXELS

    with pytest.raises(ImageValidationError, match="max"):
        process_upload(raw, tmp_path / "bomb.jpg")
    assert not (tmp_path / "bomb.jpg").exists()
