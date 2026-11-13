import pytest
from langchain_core.messages import AIMessage

from src.config import Settings, get_settings
from src.main import app


@pytest.fixture
def app_token():
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, app_token="bi-mat")


async def test_chat_without_token_is_rejected_when_token_configured(client, use_agent, app_token):
    use_agent([AIMessage("unused")])

    response = await client.post("/api/v1/chat", json={"message": "Chào"})

    assert response.status_code == 401


async def test_chat_with_wrong_token_is_rejected(client, use_agent, app_token):
    use_agent([AIMessage("unused")])

    response = await client.post("/api/v1/chat", json={"message": "Chào"}, headers={"X-App-Token": "sai"})

    assert response.status_code == 401


async def test_chat_with_correct_token_is_accepted(client, use_agent, app_token):
    use_agent([AIMessage("Xin chào!")])

    response = await client.post("/api/v1/chat", json={"message": "Chào"}, headers={"X-App-Token": "bi-mat"})

    assert response.status_code == 200


async def test_chat_is_open_when_no_token_configured(client, use_agent):
    use_agent([AIMessage("Xin chào!")])

    response = await client.post("/api/v1/chat", json={"message": "Chào"})

    assert response.status_code == 200


async def test_health_never_requires_token(client, app_token):
    response = await client.get("/health")

    assert response.status_code == 200
