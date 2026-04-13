from __future__ import annotations

import importlib
import sys

import pytest

from backend.core.config import settings
from backend.ml.tribe_loader import get_model, is_model_loaded, load_model


def test_python_version() -> None:
    assert sys.version_info[:2] == (3, 11)


def test_settings_defaults() -> None:
    assert settings.device == "cpu"
    assert settings.model_cache_path.as_posix() == "model_cache"
    assert settings.database_url == "sqlite+aiosqlite:///./brainx.db"


def test_model_loader_contract() -> None:
    assert callable(load_model)
    assert is_model_loaded() is False
    with pytest.raises(RuntimeError, match="Model not loaded"):
        get_model()


@pytest.mark.parametrize("module_name", ["tribev2", "fastapi", "sqlalchemy", "nilearn"])
def test_runtime_dependencies_available(module_name: str) -> None:
    importlib.import_module(module_name)
