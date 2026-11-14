import json

import httpx
import pytest

from src.agents.tools.child_alert import notify_child
from src.services.telegram import REPLY_OPTIONS, TelegramService


def make_service(sent: list, replies: list | None = None, chat_ids=(111,)) -> TelegramService:
    def handler(request: httpx.Request) -> httpx.Response:
        method = request.url.path.rsplit("/", 1)[-1]
        is_json = request.headers.get("content-type", "").startswith("application/json")
        sent.append((method, json.loads(request.content) if is_json else {}))
        return httpx.Response(200, json={"ok": True, "result": []})

    on_reply = (lambda event_id, text: replies.append((event_id, text))) if replies is not None else None
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return TelegramService("TOKEN", list(chat_ids), client=client, on_reply=on_reply)


def callback(chat_id: int, data: str) -> dict:
    message = {"chat": {"id": chat_id}, "message_id": 9}
    return {"update_id": 1, "callback_query": {"id": "q1", "data": data, "message": message}}


async def test_send_alert_sends_buttons_to_every_child():
    sent: list = []
    service = make_service(sent, chat_ids=(111, 222))
    await service.send_alert("e1", "Tin nhắn lừa đảo")
    assert sorted(p["chat_id"] for _, p in sent) == [111, 222]
    buttons = sent[0][1]["reply_markup"]["inline_keyboard"]
    assert [b[0]["text"] for b in buttons] == list(REPLY_OPTIONS.values())
    assert all(b[0]["callback_data"].startswith("r:e1:") for b in buttons)


async def test_send_alert_with_image_uses_send_photo():
    sent: list = []
    await make_service(sent).send_alert("e1", "Tin nhắn lừa đảo", image=b"jpeg")
    assert [m for m, _ in sent] == ["sendPhoto"]


async def test_button_press_passes_reply_to_handler():
    sent: list = []
    replies: list = []
    await make_service(sent, replies).handle_update(callback(111, "r:e1:safe"))
    assert replies == [("e1", REPLY_OPTIONS["safe"])]
    assert "answerCallbackQuery" in {m for m, _ in sent}


async def test_typed_message_becomes_reply():
    replies: list = []
    update = {"update_id": 2, "message": {"chat": {"id": 111}, "text": "Mẹ ơi con đây"}}
    await make_service([], replies).handle_update(update)
    assert replies == [(None, "Mẹ ơi con đây")]


@pytest.mark.parametrize(
    "update",
    [
        callback(999, "r:e1:safe"),
        callback(111, "r:e1:nope"),
        callback(111, "bậy"),
        {"message": {"chat": {"id": 999}, "text": "người lạ"}},
        {"message": {"chat": {"id": 111}, "text": "/start"}},
    ],
)
async def test_ignores_unknown_chat_or_bad_data(update):
    replies: list = []
    await make_service([], replies).handle_update(update)
    assert replies == []


async def test_notify_child_tool_without_config(monkeypatch):
    monkeypatch.setattr("src.agents.tools.child_alert.get_telegram", lambda: None)
    assert "Chưa cấu hình" in await notify_child.ainvoke({"summary": "x"})


async def test_notify_child_tool_sends_alert(monkeypatch):
    sent: list = []
    monkeypatch.setattr("src.agents.tools.child_alert.get_telegram", lambda: make_service(sent))
    assert "Đã báo cho con" in await notify_child.ainvoke({"summary": "Tin nhắn lạ đòi chuyển tiền"})
    assert "Tin nhắn lạ đòi chuyển tiền" in sent[0][1]["text"]
