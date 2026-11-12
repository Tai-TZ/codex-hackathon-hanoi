from src.config import Settings


def make_settings(**overrides) -> Settings:
    return Settings(_env_file=None, openai_api_key="openai-key", google_api_key="google-key", **overrides)


def test_gemini_model_uses_google_key():
    settings = make_settings(llm_model="gemini-3.1-flash-lite")

    assert settings.llm_provider == "google"
    assert settings.llm_api_key == "google-key"
    assert settings.llm_api_key_name == "GOOGLE_API_KEY"


def test_other_models_use_openai_key():
    settings = make_settings(llm_model="gpt-5-mini")

    assert settings.llm_provider == "openai"
    assert settings.llm_api_key == "openai-key"
    assert settings.llm_api_key_name == "OPENAI_API_KEY"


def test_fallback_models_are_parsed_and_deduplicated():
    settings = make_settings(
        llm_model="gemini-3.1-flash-lite",
        llm_fallback_models=" gemini-3.5-flash-lite, gpt-5-mini ,gemini-3.1-flash-lite,,gemini-3.5-flash-lite",
    )

    assert settings.fallback_models == ["gemini-3.5-flash-lite", "gpt-5-mini"]


def test_fallback_models_without_an_api_key_are_skipped():
    settings = Settings(
        _env_file=None,
        llm_model="gemini-3.1-flash-lite",
        google_api_key="google-key",
        openai_api_key="",
        llm_fallback_models="gpt-5-mini,gemini-2.5-flash",
    )

    assert settings.fallback_models == ["gemini-2.5-flash"]


def test_no_fallback_models_by_default():
    assert make_settings(llm_model="gpt-5-mini").fallback_models == []
