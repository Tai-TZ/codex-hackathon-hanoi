from langchain_core.language_models import BaseChatModel

from src.config import Settings


def get_llm(settings: Settings) -> BaseChatModel:
    if settings.llm_provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.llm_model,
            google_api_key=settings.llm_api_key,
            timeout=settings.llm_timeout_seconds,
            max_retries=2,
        )

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        timeout=settings.llm_timeout_seconds,
        max_retries=2,
    )
