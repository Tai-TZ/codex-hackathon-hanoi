from collections.abc import Sequence

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langgraph.checkpoint.memory import MemorySaver

from src.agents.graph import build_graph
from src.api.routes import get_agent
from src.config import Settings, get_settings
from src.main import app


class FakeToolCallingModel(FakeMessagesListChatModel):
    """LLM giả: trả lần lượt các message cho sẵn, không gọi OpenAI."""

    def bind_tools(self, tools, **kwargs):
        return self


class FailingModel(FakeToolCallingModel):
    """LLM giả luôn lỗi, để thử cơ chế chuyển sang model dự phòng."""

    def _generate(self, *args, **kwargs):
        raise RuntimeError("503 UNAVAILABLE: model quá tải")


def make_fake_agent(responses: Sequence[BaseMessage]):
    return build_graph(FakeToolCallingModel(responses=list(responses)), checkpointer=MemorySaver())


def tool_call_message(name: str, args: dict) -> AIMessage:
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": f"call_{name}"}])


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def use_agent():
    """Thay agent thật bằng agent chạy LLM giả với các câu trả lời cho sẵn."""

    def _use(responses: Sequence[BaseMessage]):
        agent = make_fake_agent(responses)
        app.dependency_overrides[get_agent] = lambda: agent
        return agent

    return _use


@pytest.fixture
def no_api_key():
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, llm_model="gpt-5-mini", openai_api_key="", google_api_key="", llm_fallback_models=""
    )


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
