"""Agent Hỏi Con: xem ảnh hoặc câu hỏi của bố mẹ, phân loại và trả kết quả có cấu trúc.

Một lần gọi model có cấu trúc đầu ra (nhanh và ổn định hơn vòng ReAct cho demo).
Việc báo cho con là luật cứng viết bằng code ở src/api/routes.py, không tuỳ model.
"""

import asyncio
import base64
import logging
from datetime import datetime
from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import Runnable
from pydantic import BaseModel, Field

from src.agents.prompts import ASK_PROMPT
from src.config import get_settings
from src.services.llm import get_llm

logger = logging.getLogger(__name__)


class DrugItem(BaseModel):
    drug: str = Field(description="Tên thuốc và hàm lượng, ví dụ 'Amlodipin 5mg'")
    dose: str = Field(description="Liều mỗi lần, ví dụ '1 viên'")
    times: list[str] = Field(default_factory=list, description="Giờ uống dạng HH:MM, ví dụ ['07:00', '19:00']")
    note: str = Field(default="", description="Ghi chú ngắn: trước/sau ăn, số ngày")


class DrugQuestion(BaseModel):
    item_index: int = Field(description="Vị trí thuốc trong prescription_items (từ 0) mà câu hỏi nói tới")
    text: str = Field(description="Câu hỏi Đúng/Không phải về chỗ đọc chưa chắc")


class Analysis(BaseModel):
    kind: Literal["scam", "prescription", "document", "other", "emergency"]
    risk: Literal["red", "yellow", "green"]
    confidence: float = Field(ge=0, le=1, description="Mức chắc chắn của nhận định")
    title: str = Field(description="Một dòng kết luận, tối đa 8 từ")
    answer: str = Field(description="1 đến 3 câu ngắn, lời đời thường, để đọc to")
    actions: list[str] = Field(default_factory=list, description="2-4 việc cần làm, mỗi việc tối đa 8 từ")
    alert_summary: str = Field(default="", description="Một câu kể cho người con chuyện gì đang xảy ra")
    prescription_items: list[DrugItem] = Field(default_factory=list)
    prescription_questions: list[DrugQuestion] = Field(default_factory=list)


class RacingAnalyzer:
    """Gọi model chính; nếu sau `stagger` giây chưa xong (hoặc lỗi) thì gọi thêm model kế tiếp
    và lấy câu trả lời đầu tiên. Gemini hay treo từng lúc, chờ hết timeout rồi mới đổi model thì quá lâu."""

    def __init__(self, models: list[Runnable], stagger: float) -> None:
        self.models = models
        self.stagger = stagger

    async def ainvoke(self, messages: list) -> Analysis:
        pending: set[asyncio.Task] = set()
        next_index = 0
        last_error: Exception = RuntimeError("Không có model nào")
        try:
            while True:
                if next_index < len(self.models):
                    pending.add(asyncio.create_task(self.models[next_index].ainvoke(messages)))
                    next_index += 1
                elif not pending:
                    raise last_error
                more_models = next_index < len(self.models)
                done, pending = await asyncio.wait(
                    pending, timeout=self.stagger if more_models else None, return_when=asyncio.FIRST_COMPLETED
                )
                for task in done:
                    if task.exception() is None:
                        return task.result()
                    last_error = task.exception()
                    logger.warning("Một model lỗi, thử model khác: %s", str(last_error)[:200])
        finally:
            for task in pending:
                task.cancel()


@lru_cache
def get_analyzer() -> RacingAnalyzer:
    settings = get_settings()
    names = [settings.llm_model, *settings.fallback_models]
    models = [get_llm(settings, name).with_structured_output(Analysis) for name in names]
    return RacingAnalyzer(models, settings.llm_stagger_seconds)


WEEKDAYS = ["thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy", "Chủ nhật"]


def now_vietnam() -> str:
    """Ngày giờ hiện tại để agent trả lời đúng các câu như 'hôm nay thứ mấy'."""
    now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    return f"{WEEKDAYS[now.weekday()]}, ngày {now.day}/{now.month}/{now.year}, {now:%H:%M}"


def build_messages(text: str | None, image: bytes | None, history: list[dict], parent_title: str) -> list:
    parts: list[dict] = [{"type": "text", "text": f"Bây giờ là {now_vietnam()} (giờ Việt Nam)."}]
    if history:
        lines = [
            f"- {parent_title} hỏi: {h.get('question_text') or '(gửi một ảnh)'} -> con trả lời: {h['answer']}"
            for h in history
        ]
        parts.append({"type": "text", "text": "Các câu hỏi trước trong cùng cuộc trò chuyện:\n" + "\n".join(lines)})
    if text:
        parts.append({"type": "text", "text": f"{parent_title.capitalize()} nói: {text}"})
    if image:
        parts.append({"type": "text", "text": f"{parent_title.capitalize()} gửi ảnh này, hãy xem giúp:"})
        b64 = base64.b64encode(image).decode()
        parts.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
    return [SystemMessage(ASK_PROMPT.format(parent=parent_title)), HumanMessage(content=parts)]


async def analyze(
    analyzer: Runnable, text: str | None, image: bytes | None, history: list[dict], parent_title: str
) -> Analysis:
    result = await analyzer.ainvoke(build_messages(text, image, history, parent_title))
    return result if isinstance(result, Analysis) else Analysis.model_validate(result)
