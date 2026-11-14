"""Gửi cảnh báo cho người con qua Telegram và nhận câu trả lời nhanh khi con bấm nút.

Nhận nút bấm bằng long polling (không cần địa chỉ https). Câu trả lời được đưa cho `on_reply`
(lưu vào SQLite), máy của bố mẹ hỏi qua GET /api/v1/replies rồi đọc to.
"""

import asyncio
import json
import logging
from collections.abc import Callable
from functools import lru_cache

import httpx

from src.config import get_settings
from src.services.store import get_store

logger = logging.getLogger(__name__)

# callback_data của Telegram tối đa 64 byte nên chỉ gửi khoá ngắn, nội dung câu tra theo bảng này.
REPLY_OPTIONS: dict[str, str] = {
    "safe": "Con ổn, mẹ đừng chuyển tiền",
    "call": "Mẹ chờ chút, con gọi ngay",
    "ok": "Việc này không sao đâu mẹ",
}

# on_reply(event_id | None, text): event_id None nghĩa là con gõ câu riêng, gắn vào cảnh báo mới nhất.
ReplyHandler = Callable[[str | None, str], None]


class TelegramService:
    def __init__(
        self,
        token: str,
        chat_ids: list[int],
        client: httpx.AsyncClient | None = None,
        on_reply: ReplyHandler | None = None,
    ) -> None:
        self._base = f"https://api.telegram.org/bot{token}"
        self.chat_ids = chat_ids
        self._client = client or httpx.AsyncClient(timeout=35)
        self._on_reply = on_reply or (lambda event_id, text: None)
        self._offset = 0

    async def _call(self, method: str, files: dict | None = None, **payload) -> dict:
        # Không log URL vì có token.
        try:
            if files:
                data = {k: v if isinstance(v, str) else json.dumps(v) for k, v in payload.items()}
                res = await self._client.post(f"{self._base}/{method}", data=data, files=files)
            else:
                res = await self._client.post(f"{self._base}/{method}", json=payload)
        except httpx.HTTPError as e:
            raise RuntimeError(f"Telegram {method} lỗi mạng: {type(e).__name__}") from None
        body = res.json()
        if not body.get("ok"):
            raise RuntimeError(f"Telegram {method} lỗi: {body.get('description')}")
        return body

    async def send_alert(self, event_id: str, summary: str, image: bytes | None = None) -> None:
        """Gửi cảnh báo (kèm ảnh nếu có) và nút trả lời nhanh tới mọi người con."""
        keyboard = {
            "inline_keyboard": [
                [{"text": text, "callback_data": f"r:{event_id}:{key}"}] for key, text in REPLY_OPTIONS.items()
            ]
        }
        text = f"🚨 Hỏi Con báo: {summary}\n\nBấm một nút để trả lời, máy của mẹ sẽ đọc to. Hoặc gõ một câu bất kỳ."

        async def send(chat_id: int) -> None:
            if image:
                files = {"photo": ("anh.jpg", image, "image/jpeg")}
                try:
                    await self._call(
                        "sendPhoto", files=files, chat_id=str(chat_id), caption=text[:1000], reply_markup=keyboard
                    )
                    return
                except RuntimeError:
                    logger.exception("Gửi ảnh qua Telegram lỗi, gửi chữ thay thế")
            await self._call("sendMessage", chat_id=chat_id, text=text, reply_markup=keyboard)

        results = await asyncio.gather(*(send(c) for c in self.chat_ids), return_exceptions=True)
        failures = [r for r in results if isinstance(r, Exception)]
        for failure in failures:
            logger.error("Gửi Telegram thất bại: %s", failure)
        if len(failures) == len(results):
            raise RuntimeError("Không gửi được cảnh báo qua Telegram")

    async def handle_update(self, update: dict) -> None:
        message = update.get("message")
        if message:
            text = (message.get("text") or "").strip()
            if message.get("chat", {}).get("id") in self.chat_ids and text and not text.startswith("/"):
                self._on_reply(None, text[:300])
                await self._safe_call(
                    "sendMessage", chat_id=message["chat"]["id"], text="Đã gửi cho mẹ, máy mẹ sẽ đọc to."
                )
            return

        query = update.get("callback_query")
        if not query:
            return
        chat = (query.get("message") or {}).get("chat", {})
        if chat.get("id") not in self.chat_ids:
            logger.warning("Bỏ qua nút bấm từ chat lạ")
            return
        try:
            _, event_id, key = query.get("data", "").split(":")
            text = REPLY_OPTIONS[key]
        except (ValueError, KeyError):
            return
        self._on_reply(event_id, text)
        await self._safe_call("answerCallbackQuery", callback_query_id=query["id"], text="Đã gửi cho mẹ")
        await self._safe_call("sendMessage", chat_id=chat["id"], text=f"Đã gửi cho mẹ: “{text}”. Máy mẹ đang đọc to.")

    async def _safe_call(self, method: str, **payload) -> None:
        try:
            await self._call(method, **payload)
        except Exception:
            logger.exception("Telegram %s lỗi sau khi con trả lời", method)

    async def poll_forever(self) -> None:
        logger.info("Bắt đầu nhận trả lời từ Telegram")
        # Bỏ các tin cũ còn tồn từ trước khi server chạy, để không đọc lại câu trả lời cũ cho bố mẹ.
        while True:
            try:
                backlog = (await self._call("getUpdates", offset=-1, timeout=0))["result"]
                if backlog:
                    self._offset = backlog[-1]["update_id"] + 1
                break
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("Chưa kết nối được Telegram (%s), thử lại sau 3 giây", e)
                await asyncio.sleep(3)
        while True:
            try:
                data = await self._call(
                    "getUpdates", offset=self._offset, timeout=25, allowed_updates=["callback_query", "message"]
                )
                for update in data["result"]:
                    self._offset = update["update_id"] + 1
                    await self.handle_update(update)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning("Chưa nhận được cập nhật từ Telegram (%s), thử lại sau 3 giây", e)
                await asyncio.sleep(3)


DEFAULT_FAMILY = "demo"


def _save_reply(event_id: str | None, text: str) -> None:
    store = get_store()
    family = (store.family_of(event_id) if event_id else None) or DEFAULT_FAMILY
    target = event_id or store.latest_event_id(family) or ""
    store.add_reply(family, target, text, get_settings().child_name)


@lru_cache
def get_telegram() -> TelegramService | None:
    settings = get_settings()
    if not (settings.telegram_bot_token and settings.telegram_chat_ids):
        return None
    return TelegramService(settings.telegram_bot_token, settings.telegram_chat_ids, on_reply=_save_reply)
