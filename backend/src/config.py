from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

Provider = Literal["openai", "google"]


def provider_for(model: str) -> Provider:
    """Model tên bắt đầu bằng "gemini" dùng Google, còn lại dùng OpenAI."""
    return "google" if model.startswith("gemini") else "openai"


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
    llm_model: str = "gpt-5-mini"
    # Các model dự phòng, cách nhau bằng dấu phẩy. Khi model chính lỗi hoặc quá tải,
    # agent thử lần lượt các model này.
    llm_fallback_models: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    # Để ngắn: model chính treo thì chuyển sang model dự phòng nhanh.
    llm_timeout_seconds: float = 25.0
    llm_max_retries: int = 1

    def api_key_for(self, model: str) -> str:
        return self.google_api_key if provider_for(model) == "google" else self.openai_api_key

    @property
    def llm_provider(self) -> Provider:
        return provider_for(self.llm_model)

    @property
    def llm_api_key_name(self) -> str:
        return "GOOGLE_API_KEY" if self.llm_provider == "google" else "OPENAI_API_KEY"

    @property
    def llm_api_key(self) -> str:
        return self.api_key_for(self.llm_model)

    @property
    def fallback_models(self) -> list[str]:
        """Model dự phòng dùng được: khác model chính, không trùng nhau, và đã có API key."""
        models: list[str] = []
        for name in (m.strip() for m in self.llm_fallback_models.split(",")):
            if name and name != self.llm_model and name not in models and self.api_key_for(name):
                models.append(name)
        return models


@lru_cache
def get_settings() -> Settings:
    return Settings()
