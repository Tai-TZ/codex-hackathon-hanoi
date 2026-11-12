import logging
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.errors import GraphRecursionError
from langgraph.graph.state import CompiledStateGraph

from src.agents.graph import get_default_agent
from src.config import Settings, get_settings
from src.models.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Chặn agent gọi tool lặp vô hạn (mỗi vòng agent -> tools tốn 2 bước).
MAX_AGENT_STEPS = 12


def get_agent(settings: Annotated[Settings, Depends(get_settings)]) -> CompiledStateGraph:
    if not settings.llm_api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Backend chưa có {settings.llm_api_key_name}. Điền key vào backend/.env rồi chạy lại server.",
        )
    return get_default_agent()


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
