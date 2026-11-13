import logging
import secrets
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.graph.state import CompiledStateGraph

from src.agents.graph import build_default_agent
from src.config import Settings, get_settings
from src.models.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)


def require_app_token(
    settings: Annotated[Settings, Depends(get_settings)],
    x_app_token: Annotated[str | None, Header()] = None,
) -> None:
    """Backend public qua internet: chỉ app có token mới gọi được (khi APP_TOKEN được đặt)."""
    if not settings.app_token:
        return
    if x_app_token is None or not secrets.compare_digest(x_app_token.encode(), settings.app_token.encode()):
        raise HTTPException(status_code=401, detail="Thiếu hoặc sai X-App-Token.")


router = APIRouter(dependencies=[Depends(require_app_token)])

# Chặn agent gọi tool lặp vô hạn (mỗi vòng agent -> tools tốn 2 bước).
MAX_AGENT_STEPS = 12


def get_agent(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> CompiledStateGraph:
    if not settings.llm_api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Backend chưa có {settings.llm_api_key_name}. Điền key vào backend/.env rồi chạy lại server.",
        )
    state = request.app.state
    agent = getattr(state, "agent", None)
    if agent is None:
        # Checkpointer được chọn lúc khởi động (src/main.py). Lifespan chưa chạy thì dùng RAM.
        checkpointer = getattr(state, "checkpointer", None)
        if checkpointer is None:
            checkpointer = state.checkpointer = MemorySaver()
        agent = state.agent = build_default_agent(settings, checkpointer)
    return agent


def _message_text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    parts = [block if isinstance(block, str) else block.get("text", "") for block in content]
    return "".join(parts)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    agent: Annotated[CompiledStateGraph, Depends(get_agent)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatResponse:
    """Gửi một tin nhắn cho agent và nhận câu trả lời."""
    thread_id = request.thread_id or uuid4().hex
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": MAX_AGENT_STEPS}
    user_message = HumanMessage(request.message, id=uuid4().hex)

    try:
        result = await agent.ainvoke({"messages": [user_message]}, config)
    except GraphRecursionError:
        logger.warning("Agent vượt quá %s bước, thread_id=%s", MAX_AGENT_STEPS, thread_id)
        raise HTTPException(status_code=502, detail="Agent xử lý quá nhiều bước mà chưa có câu trả lời.")
    except Exception as e:
        logger.exception("Agent lỗi, thread_id=%s", thread_id)
        detail = f"Agent lỗi: {e}" if settings.app_env == "development" else "Agent gặp lỗi, thử lại sau."
        raise HTTPException(status_code=502, detail=detail)

    # Chỉ lấy các message sinh ra trong lượt này (sau tin nhắn user vừa gửi).
    messages: list[BaseMessage] = result["messages"]
    turn_start = next(i for i in range(len(messages) - 1, -1, -1) if messages[i].id == user_message.id)
    turn = messages[turn_start + 1 :]
    tools_used = [call["name"] for m in turn if isinstance(m, AIMessage) for call in m.tool_calls]

    return ChatResponse(response=_message_text(messages[-1]), thread_id=thread_id, tools_used=tools_used)
