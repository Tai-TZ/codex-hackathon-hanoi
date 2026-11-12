"""Agent dạng ReAct: LLM quyết định gọi tool hay trả lời, lặp đến khi có câu trả lời.

START -> agent -> (có tool call?) -> tools -> agent -> ... -> END
"""

from collections.abc import Sequence
from functools import lru_cache

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from src.agents.prompts import SYSTEM_PROMPT
from src.agents.state import AgentState
from src.agents.tools import TOOLS
from src.config import get_settings
from src.services.llm import get_llm


def build_graph(
    llm: BaseChatModel,
    tools: Sequence[BaseTool] = TOOLS,
    checkpointer: BaseCheckpointSaver | None = None,
    fallback_llms: Sequence[BaseChatModel] = (),
) -> CompiledStateGraph:
    """`fallback_llms`: các model thử lần lượt khi `llm` lỗi (quá tải, hết thời gian chờ…)."""
    llm_with_tools = llm.bind_tools(tools)
    if fallback_llms:
        llm_with_tools = llm_with_tools.with_fallbacks([fb.bind_tools(tools) for fb in fallback_llms])

    async def call_model(state: AgentState) -> dict:
        messages = [SystemMessage(SYSTEM_PROMPT), *state["messages"]]
        return {"messages": [await llm_with_tools.ainvoke(messages)]}

    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.add_node("tools", ToolNode(tools))
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", tools_condition)
    graph.add_edge("tools", "agent")
    return graph.compile(checkpointer=checkpointer)


@lru_cache
def get_default_agent() -> CompiledStateGraph:
    # MemorySaver giữ lịch sử hội thoại trong RAM: mất khi restart server và
    # không chia sẻ giữa nhiều worker. Đủ cho demo; cần bền hơn thì đổi checkpointer.
    settings = get_settings()
    return build_graph(
        get_llm(settings),
        checkpointer=MemorySaver(),
        fallback_llms=[get_llm(settings, model) for model in settings.fallback_models],
    )
