from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


class Settings(BaseSettings):
    device: str = "cpu"
    model_cache_path: Path = Path("./model_cache")
    database_url: str = "sqlite+aiosqlite:///./brainx.db"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_text_model: str = "deepseek-chat"
    replicate_api_token: str = ""
    vision_provider: str = "replicate"
    vision_model: str = "deepseek-ai/deepseek-vl2"
    uploads_dir: Path = Path("./uploads")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
