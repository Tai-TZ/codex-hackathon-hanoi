import asyncio

import pytest
from langchain_core.runnables import RunnableLambda

from src.agents.analyzer import Analysis, DrugItem, DrugQuestion, RacingAnalyzer
from src.api.routes import background_tasks, get_analyzer_dep
from src.main import app
from src.services.store import Store, get_store

SCAM = Analysis(
    kind="scam",
    risk="red",
    confidence=0.95,
    title="Tin nhắn này là lừa đảo",
    answer="Đây là tin nhắn mạo danh công an.",
    actions=["Không chuyển tiền"],
    alert_summary="Mẹ nhận tin nhắn mạo danh công an",
)
SAFE = Analysis(kind="other", risk="green", confidence=0.9, title="Không sao", answer="Bình thường mẹ nhé.")


class FakeTelegram:
    def __init__(self, fail: bool = False):
        self.alerts: list = []
        self.fail = fail

    async def send_alert(self, event_id, summary, image=None):
        if self.fail:
            raise RuntimeError("mạng lỗi")
        self.alerts.append((event_id, summary, image))


@pytest.fixture
def store(tmp_path):
    store = Store(tmp_path / "t.db")
    app.dependency_overrides[get_store] = lambda: store
    return store


@pytest.fixture
def telegram(monkeypatch):
    fake = FakeTelegram()
    monkeypatch.setattr("src.api.routes.get_telegram", lambda: fake)
    return fake


async def post_ask(client, **kwargs) -> dict:
    """Gọi /ask rồi chờ việc gửi Telegram chạy nền xong."""
    body = (await client.post("/api/v1/ask", **kwargs)).json()
    await asyncio.gather(*background_tasks)
    return body


def use_analysis(analysis: Analysis):
    seen: list = []

    def run(messages):
        seen.append(messages)
        return analysis

    app.dependency_overrides[get_analyzer_dep] = lambda: RunnableLambda(run)
    return seen


async def test_red_result_always_notifies_child(client, store, telegram):
    use_analysis(SCAM)
    body = await post_ask(client, data={"text": "công an bảo chuyển tiền"})
    assert body["risk"] == "red" and body["family_notified"] is True
    assert telegram.alerts == [(body["id"], "Mẹ nhận tin nhắn mạo danh công an", None)]


async def test_red_result_still_reaches_child_app_when_telegram_fails(client, store, monkeypatch):
    monkeypatch.setattr("src.api.routes.get_telegram", lambda: FakeTelegram(fail=True))
    use_analysis(SCAM)
    body = await post_ask(client, data={"text": "x"})
    assert body["family_notified"] is True
    saved = (await client.get("/api/v1/events")).json()["events"][0]
    assert saved["id"] == body["id"] and store.get_event(body["id"])["telegram_sent"] is False


async def test_emergency_is_forced_red(client, store, telegram):
    use_analysis(SAFE.model_copy(update={"kind": "emergency"}))
    body = await post_ask(client, data={"text": "mẹ đau ngực"})
    assert body["risk"] == "red" and len(telegram.alerts) == 1


async def test_green_result_does_not_notify(client, store, telegram):
    use_analysis(SAFE)
    body = await post_ask(client, data={"text": "hôm nay thứ mấy"})
    assert body["family_notified"] is False and telegram.alerts == []


async def test_ask_with_image_saves_and_serves_it(client, store, telegram):
    seen = use_analysis(SCAM)
    files = {"image": ("a.jpg", b"\xff\xd8jpeg", "image/jpeg")}
    body = await post_ask(client, files=files, data={"family_id": "demo"})
    assert body["image_url"] == f"/api/v1/events/{body['id']}/image"
    assert (await client.get(body["image_url"])).content == b"\xff\xd8jpeg"
    assert any(part.get("type") == "image_url" for part in seen[0][1].content)
    assert telegram.alerts[0][2] == b"\xff\xd8jpeg"


async def test_ask_requires_image_or_text(client, store):
    use_analysis(SAFE)
    assert (await client.post("/api/v1/ask", data={"family_id": "demo"})).status_code == 422


async def test_ask_reports_agent_failure(client, store):
    def boom(_):
        raise RuntimeError("503")

    app.dependency_overrides[get_analyzer_dep] = lambda: RunnableLambda(boom)
    assert (await client.post("/api/v1/ask", data={"text": "x"})).status_code == 502


async def test_follow_up_question_sees_thread_history(client, store, telegram):
    seen = use_analysis(SAFE)
    first = await post_ask(client, data={"text": "câu một"})
    await client.post("/api/v1/ask", data={"text": "câu hai", "thread_id": first["thread_id"]})
    assert "câu một" in str(seen[1][1].content)


async def test_reply_round_trip(client, store):
    sent = (await client.post("/api/v1/reply", json={"event_id": "e1", "text": "Con ổn", "from_name": "con"})).json()
    assert sent["ok"] is True
    replies = (await client.get("/api/v1/replies?after=0")).json()["replies"]
    assert [(r["event_id"], r["text"], r["from_name"]) for r in replies] == [("e1", "Con ổn", "con")]
    assert (await client.get(f"/api/v1/replies?after={sent['id']}")).json() == {"replies": []}


async def test_events_survive_restart(tmp_path):
    Store(tmp_path / "t.db").add_event(
        {"id": "e1", "family_id": "demo", "thread_id": "t", "created_at": "2026-11-14T00:00:00+00:00", "title": "x"}
    )
    assert Store(tmp_path / "t.db").list_events("demo")[0]["id"] == "e1"


async def test_prescription_confirm_builds_schedule(client, store, telegram):
    use_analysis(
        Analysis(
            kind="prescription",
            risk="yellow",
            confidence=0.7,
            title="Đơn thuốc huyết áp",
            answer="Con đọc được hai thuốc.",
            prescription_items=[
                DrugItem(drug="Amlodipin 5mg", dose="1 viên", times=["07:00"]),
                DrugItem(drug="Metformin 500mg", dose="1 viên", times=["07:00", "19:00"]),
            ],
            prescription_questions=[DrugQuestion(item_index=1, text="Metformin uống hai lần phải không mẹ?")],
        )
    )
    event = await post_ask(client, data={"text": "đơn thuốc"})
    assert event["prescription"]["questions"][0]["id"] == "q1"
    body = (
        await client.post("/api/v1/confirm", json={"event_id": event["id"], "answers": {"q1": "Không phải"}})
    ).json()
    assert [s["drug"] for s in body["schedule"]] == ["Amlodipin 5mg"]
    assert body["needs_child"] == ["Metformin 500mg"]


async def test_confirm_unknown_event(client, store):
    assert (await client.post("/api/v1/confirm", json={"event_id": "nope"})).status_code == 404


async def test_ask_json_accepts_base64_image(client, store, telegram):
    use_analysis(SCAM)
    payload = {"image_base64": "/9hqcGVn", "family_id": "demo"}
    body = (await client.post("/api/v1/ask-json", json=payload)).json()
    await asyncio.gather(*background_tasks)
    assert body["risk"] == "red" and body["image_url"]
    assert (await client.get(body["image_url"])).content == b"\xff\xd8jpeg"
    assert telegram.alerts[0][2] == b"\xff\xd8jpeg"


async def test_ask_json_rejects_bad_base64(client, store):
    use_analysis(SAFE)
    assert (await client.post("/api/v1/ask-json", json={"image_base64": "@@@"})).status_code == 422


async def test_racing_analyzer_uses_next_model_when_first_hangs_or_fails():
    async def hang(_):
        await asyncio.sleep(30)

    def boom(_):
        raise RuntimeError("503")

    racer = RacingAnalyzer([RunnableLambda(hang), RunnableLambda(boom), RunnableLambda(lambda _: SAFE)], stagger=0.01)
    assert await racer.ainvoke([]) == SAFE


async def test_racing_analyzer_raises_when_all_models_fail():
    def boom(_):
        raise RuntimeError("503")

    with pytest.raises(RuntimeError):
        await RacingAnalyzer([RunnableLambda(boom), RunnableLambda(boom)], stagger=0.01).ainvoke([])


def test_claude_models_use_native_structured_output():
    from langchain_anthropic import ChatAnthropic

    from src.agents.analyzer import structured

    llm = ChatAnthropic(model="claude-haiku-5-5", api_key="test-key")
    seen = {}
    original = ChatAnthropic.with_structured_output

    def spy(self, schema, **kwargs):
        seen.update(kwargs)
        return original(self, schema, **kwargs)

    ChatAnthropic.with_structured_output = spy
    try:
        structured(llm, "claude-haiku-5-5")
    finally:
        ChatAnthropic.with_structured_output = original
    assert seen == {"method": "json_schema"}
