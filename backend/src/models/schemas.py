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
