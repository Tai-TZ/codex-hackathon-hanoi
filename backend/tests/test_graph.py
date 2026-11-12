from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from tests.conftest import make_fake_agent, tool_call_message

CONFIG = {"configurable": {"thread_id": "t1"}}


async def test_agent_answers_directly_when_no_tool_needed():
    agent = make_fake_agent([AIMessage("Xin chào!")])

    result = await agent.ainvoke({"messages": [HumanMessage("Chào")]}, CONFIG)

    assert result["messages"][-1].content == "Xin chào!"
    assert len(result["messages"]) == 2


async def test_agent_runs_tool_then_answers_with_its_result():
    agent = make_fake_agent([tool_call_message("calculate", {"expression": "2 + 3 * 4"}), AIMessage("Kết quả là 14")])

    result = await agent.ainvoke({"messages": [HumanMessage("2 + 3 * 4 = ?")]}, CONFIG)

    tool_messages = [m for m in result["messages"] if isinstance(m, ToolMessage)]
    assert [m.content for m in tool_messages] == ["14"]
    assert result["messages"][-1].content == "Kết quả là 14"


async def test_agent_remembers_earlier_turns_in_same_thread():
    agent = make_fake_agent([AIMessage("Chào Tài"), AIMessage("Bạn tên Tài")])

    await agent.ainvoke({"messages": [HumanMessage("Mình tên Tài")]}, CONFIG)
    result = await agent.ainvoke({"messages": [HumanMessage("Mình tên gì?")]}, CONFIG)

    assert [m.content for m in result["messages"]] == ["Mình tên Tài", "Chào Tài", "Mình tên gì?", "Bạn tên Tài"]
