"""Tool báo cho người con khi bố mẹ gặp rủi ro."""

import logging

from langchain_core.tools import tool

from src.services.telegram import get_telegram

logger = logging.getLogger(__name__)


@tool
async def notify_child(summary: str) -> str:
    """Báo ngay cho người con qua Telegram khi người dùng gặp rủi ro (tin nhắn lừa đảo, bị yêu cầu
    chuyển tiền, thuốc hoặc giấy tờ đáng ngờ). `summary` là một câu ngắn nói chuyện gì đang xảy ra."""
    telegram = get_telegram()
    if telegram is None:
        return "Chưa cấu hình Telegram nên không báo được cho con."
    try:
        await telegram.send_alert("chat", summary[:500])
    except Exception:
        logger.exception("notify_child thất bại")
        return "Không báo được cho con lúc này."
    return "Đã báo cho con. Khi con bấm trả lời, máy sẽ đọc to cho bạn."
