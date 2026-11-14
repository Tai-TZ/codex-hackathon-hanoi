from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")
    thread_id: str | None = Field(
        default=None,
        max_length=100,
        description="ID cuộc hội thoại. Bỏ trống để bắt đầu hội thoại mới.",
    )


class ChatResponse(BaseModel):
    response: str = Field(..., description="Câu trả lời của agent")
    thread_id: str = Field(..., description="Gửi lại ID này ở request sau để agent nhớ ngữ cảnh")
    tools_used: list[str] = Field(default_factory=list, description="Các tool agent đã gọi")


Kind = Literal["scam", "prescription", "document", "other", "emergency"]
Risk = Literal["red", "yellow", "green"]


class DrugItem(BaseModel):
    drug: str
    dose: str = ""
    times: list[str] = Field(default_factory=list)
    note: str = ""


class DrugQuestion(BaseModel):
    id: str
    text: str
    options: list[str] = Field(default_factory=lambda: ["Đúng", "Không phải"])
    item_index: int = 0


class Prescription(BaseModel):
    items: list[DrugItem] = Field(default_factory=list)
    questions: list[DrugQuestion] = Field(default_factory=list)


class Event(BaseModel):
    """Một lần bố mẹ hỏi (ảnh hoặc chữ) kèm kết quả của agent."""

    id: str
    kind: Kind
    risk: Risk
    confidence: float
    title: str
    answer: str
    actions: list[str] = Field(default_factory=list)
    family_notified: bool = False
    prescription: Prescription | None = None
    thread_id: str
    created_at: str
    question_text: str | None = None
    image_url: str | None = None


class AskJsonRequest(BaseModel):
    """Bản JSON của /ask cho app di động: ảnh gửi dạng base64."""

    image_base64: str | None = Field(default=None, max_length=12_000_000)
    text: str | None = Field(default=None, max_length=2000)
    family_id: str = Field(default="demo", max_length=50)
    thread_id: str | None = Field(default=None, max_length=100)


class EventsResponse(BaseModel):
    events: list[Event] = Field(default_factory=list)


class ReplyRequest(BaseModel):
    family_id: str = Field(default="demo", max_length=50)
    event_id: str = Field(default="", max_length=50)
    text: str = Field(..., min_length=1, max_length=300)
    from_name: str = Field(default="", max_length=50)


class ReplyOk(BaseModel):
    ok: bool = True
    id: int


class ReplyItem(BaseModel):
    id: int = Field(..., description="Tăng dần; gửi lại id lớn nhất đã nhận ở lần hỏi sau")
    event_id: str
    text: str = Field(..., description="Câu con trả lời, để đọc to trên máy bố mẹ")
    from_name: str
    at: str


class RepliesResponse(BaseModel):
    replies: list[ReplyItem] = Field(default_factory=list)


class ConfirmRequest(BaseModel):
    event_id: str = Field(..., max_length=50)
    answers: dict[str, str] = Field(default_factory=dict)


class ScheduleItem(BaseModel):
    drug: str
    dose: str = ""
    times: list[str] = Field(default_factory=list)


class ConfirmResponse(BaseModel):
    schedule: list[ScheduleItem] = Field(default_factory=list)
    needs_child: list[str] = Field(default_factory=list, description="Thuốc chưa chắc, cần con hoặc bác sĩ xem lại")
