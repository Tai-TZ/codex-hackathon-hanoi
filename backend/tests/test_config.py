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
