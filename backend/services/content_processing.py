from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

ALLOWED_MIMES = frozenset({"image/png", "image/jpeg", "image/webp"})
MAX_INPUT_BYTES = 5 * 1024 * 1024
LONGEST_EDGE = 1024
JPEG_QUALITY = 85
# ~50 MP covers any real screenshot (8K is 33 MP). The previous 1 GP value only
# made Pillow *warn*; it raises at twice the limit, so a tiny 1-bit 40k x 40k PNG
# under the 5MB cap was decoded and convert("RGB") allocated ~4.8GB.
MAX_DECODED_PIXELS = 50_000_000

Image.MAX_IMAGE_PIXELS = MAX_DECODED_PIXELS


class ImageValidationError(ValueError):
    """Raised when an upload fails MIME, size, or decode checks."""


def process_upload(raw: bytes, out_path: Path) -> dict:
    try:
        import magic
    except ModuleNotFoundError as exc:
        raise ImageValidationError("python-magic is not installed") from exc

    if len(raw) > MAX_INPUT_BYTES:
        raise ImageValidationError(f"image > 5MB ({len(raw)} bytes) - max {MAX_INPUT_BYTES}")
    if len(raw) == 0:
        raise ImageValidationError("empty upload")

    detected = magic.from_buffer(raw[:2048], mime=True)
    if detected not in ALLOWED_MIMES:
        raise ImageValidationError(f"unsupported MIME {detected!r}")

    try:
        with Image.open(BytesIO(raw)) as im:
            # Image.open is lazy: check dimensions before anything decodes pixels.
            width, height = im.size
            if width * height > MAX_DECODED_PIXELS:
                raise ImageValidationError(
                    f"image is {width}x{height} ({width * height:,} px) - max {MAX_DECODED_PIXELS:,} px"
                )
            im = ImageOps.exif_transpose(im)
            im = im.convert("RGB")
            im.thumbnail((LONGEST_EDGE, LONGEST_EDGE), Image.Resampling.LANCZOS)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            im.save(out_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            return {
                "width": im.width,
                "height": im.height,
                "bytes": out_path.stat().st_size,
                "mime": detected,
            }
    except Image.DecompressionBombError as exc:
        raise ImageValidationError(f"decompression bomb refused: {exc}") from exc
    except (OSError, ValueError, Image.UnidentifiedImageError) as exc:
        raise ImageValidationError(f"image decode failed: {exc}") from exc
