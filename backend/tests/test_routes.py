from langchain_core.messages import AIMessage

from tests.conftest import tool_call_message


async def test_health(client):
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_chat_returns_agent_answer_and_new_thread_id(client, use_agent):
    use_agent([AIMessage("Xin chào!")])

    response = await client.post("/api/v1/chat", json={"message": "Chào"})

    assert response.status_code == 200
    body = response.json()
    assert body["response"] == "Xin chào!"
    assert body["thread_id"]
    assert body["tools_used"] == []


async def test_chat_reports_tools_used_in_this_turn_only(client, use_agent):
    use_agent(
        [
            tool_call_message("calculate", {"expression": "1 + 1"}),
            AIMessage("Bằng 2"),
            AIMessage("Không có gì"),
        ]
    )

    first = (await client.post("/api/v1/chat", json={"message": "1 + 1?"})).json()
    second = (await client.post("/api/v1/chat", json={"message": "Cảm ơn", "thread_id": first["thread_id"]})).json()

    assert first["tools_used"] == ["calculate"]
    assert first["response"] == "Bằng 2"
    assert second["thread_id"] == first["thread_id"]
    assert second["tools_used"] == []


async def test_chat_stops_agent_stuck_in_tool_loop(client, use_agent):
    # Mỗi lượt là một message riêng (như LLM thật), agent không bao giờ ngừng gọi tool.
    use_agent([tool_call_message("calculate", {"expression": f"{i} + 1"}) for i in range(50)])

    response = await client.post("/api/v1/chat", json={"message": "loop"})

    assert response.status_code == 502


async def test_chat_rejects_empty_message(client, use_agent):
    use_agent([AIMessage("unused")])

    response = await client.post("/api/v1/chat", json={"message": ""})

    assert response.status_code == 422


async def test_chat_explains_missing_api_key(client, no_api_key):
    response = await client.post("/api/v1/chat", json={"message": "Chào"})

    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]
