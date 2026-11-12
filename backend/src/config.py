from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Hackathon Agent API"
    app_env: Literal["development", "production", "test"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "*"

    # LLM
    # Model tên bắt đầu bằng "gemini" dùng GOOGLE_API_KEY, còn lại dùng OPENAI_API_KEY.
    llm_model: str = "gpt-5-mini"
    openai_api_key: str = ""
    google_api_key: str = ""
    llm_timeout_seconds: float = 60.0

    @property
    def llm_provider(self) -> Literal["openai", "google"]:
        return "google" if self.llm_model.startswith("gemini") else "openai"

    @property
    def llm_api_key_name(self) -> str:
        return "GOOGLE_API_KEY" if self.llm_provider == "google" else "OPENAI_API_KEY"

    @property
    def llm_api_key(self) -> str:
        return self.google_api_key if self.llm_provider == "google" else self.openai_api_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
