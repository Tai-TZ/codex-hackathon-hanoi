from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

Provider = Literal["openai", "google", "anthropic"]


def provider_for(model: str) -> Provider:
    """Tên bắt đầu bằng "gemini" dùng Google, "claude" dùng Anthropic, còn lại dùng OpenAI."""
    if model.startswith("gemini"):
        return "google"
    if model.startswith("claude"):
        return "anthropic"
    return "openai"


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
    anthropic_api_key: str = ""
    # Để ngắn: model chính treo thì chuyển sang model dự phòng nhanh.
    llm_timeout_seconds: float = 25.0
    llm_max_retries: int = 1
    # Hỏi Con: sau từng này giây model chưa trả lời thì gọi thêm model kế tiếp, lấy câu trả lời đầu tiên.
    llm_stagger_seconds: float = 6.0
    # Hỏi Con: model cho việc nhẹ (câu hỏi bằng chữ, ngắn). Bỏ trống thì mọi câu đều dùng LLM_MODEL.
    # Câu có ảnh hoặc dài hơn LLM_HEAVY_TEXT_CHARS ký tự luôn dùng LLM_MODEL (việc nặng).
    llm_light_model: str = ""
    llm_heavy_text_chars: int = 300

    # Hỏi Con: giọng đọc tự nhiên bằng Gemini TTS (dùng GOOGLE_API_KEY). Bỏ trống TTS_MODEL thì app dùng giọng của máy.
    tts_model: str = "gemini-3.8-flash-lite-tts"
    tts_voice: str = "Charon"
    tts_timeout_seconds: float = 20.0

    # Hỏi Con
    db_path: str = "data/hoicon.db"  # tương đối so với thư mục backend
    child_name: str = ""  # tên người con, chỉ lưu kèm câu trả lời; giao diện gọi chung là "con"
    parent_title: str = "mẹ"

    # Telegram: bot báo cho người con. TELEGRAM_CHAT_ID có thể là nhiều ID cách nhau bằng dấu phẩy.
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    @property
    def telegram_chat_ids(self) -> list[int]:
        return [int(x) for x in (c.strip() for c in self.telegram_chat_id.split(",")) if x.lstrip("-").isdigit()]

    def api_key_for(self, model: str) -> str:
        keys = {"google": self.google_api_key, "anthropic": self.anthropic_api_key, "openai": self.openai_api_key}
        return keys[provider_for(model)]

    @property
    def llm_provider(self) -> Provider:
        return provider_for(self.llm_model)

    @property
    def llm_api_key_name(self) -> str:
        names = {"google": "GOOGLE_API_KEY", "anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY"}
        return names[self.llm_provider]

    @property
    def llm_api_key(self) -> str:
        return self.api_key_for(self.llm_model)

    @property
    def light_model(self) -> str | None:
        """Model việc nhẹ, chỉ khi đã cấu hình và có API key."""
        name = self.llm_light_model.strip()
        return name if name and self.api_key_for(name) else None

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
