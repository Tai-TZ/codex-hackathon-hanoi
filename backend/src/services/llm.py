from langchain_core.language_models import BaseChatModel

from src.config import Settings, provider_for


def get_llm(settings: Settings, model: str | None = None) -> BaseChatModel:
    """Tạo chat model. Bỏ trống `model` để dùng model chính trong cấu hình."""
    model = model or settings.llm_model
    api_key = settings.api_key_for(model)

    if provider_for(model) == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
        )

    if provider_for(model) == "anthropic":
        from langchain_anthropic import ChatAnthropic

        # Không đặt temperature: các model Claude mới từ chối tham số lấy mẫu khác mặc định.
        return ChatAnthropic(
            model=model,
            api_key=api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
            max_tokens=4096,
        )

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        timeout=settings.llm_timeout_seconds,
        max_retries=settings.llm_max_retries,
    )
