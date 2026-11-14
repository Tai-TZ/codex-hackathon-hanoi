import asyncio
import base64
import logging
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.runnables import Runnable
from langgraph.errors import GraphRecursionError
from langgraph.graph.state import CompiledStateGraph

from src.agents.analyzer import analyze, get_analyzer
from src.agents.graph import get_default_agent
from src.config import Settings, get_settings
from src.models.schemas import (
    AskJsonRequest,
    ChatRequest,
    ChatResponse,
    ConfirmRequest,
    ConfirmResponse,
    Event,
    EventsResponse,
    RepliesResponse,
    ReplyOk,
    ReplyRequest,
    ScheduleItem,
    TtsRequest,
    TtsResponse,
)
from src.services.store import Store, get_store, now_iso
from src.services.telegram import get_telegram
from src.services.tts import TtsService, get_tts

logger = logging.getLogger(__name__)
router = APIRouter()

# Chặn agent gọi tool lặp vô hạn (mỗi vòng agent -> tools tốn 2 bước).
MAX_AGENT_STEPS = 12


def get_agent(settings: Annotated[Settings, Depends(get_settings)]) -> CompiledStateGraph:
    if not settings.llm_api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Backend chưa có {settings.llm_api_key_name}. Điền key vào backend/.env rồi chạy lại server.",
        )
    return get_default_agent()


def _message_text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    parts = [block if isinstance(block, str) else block.get("text", "") for block in content]
    return "".join(parts)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    agent: Annotated[CompiledStateGraph, Depends(get_agent)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatResponse:
    """Gửi một tin nhắn cho agent và nhận câu trả lời."""
    thread_id = request.thread_id or uuid4().hex
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": MAX_AGENT_STEPS}
    user_message = HumanMessage(request.message, id=uuid4().hex)

    try:
        result = await agent.ainvoke({"messages": [user_message]}, config)
    except GraphRecursionError:
        logger.warning("Agent vượt quá %s bước, thread_id=%s", MAX_AGENT_STEPS, thread_id)
        raise HTTPException(status_code=502, detail="Agent xử lý quá nhiều bước mà chưa có câu trả lời.")
    except Exception as e:
        logger.exception("Agent lỗi, thread_id=%s", thread_id)
        detail = f"Agent lỗi: {e}" if settings.app_env == "development" else "Agent gặp lỗi, thử lại sau."
        raise HTTPException(status_code=502, detail=detail)

    # Chỉ lấy các message sinh ra trong lượt này (sau tin nhắn user vừa gửi).
    messages: list[BaseMessage] = result["messages"]
    turn_start = next(i for i in range(len(messages) - 1, -1, -1) if messages[i].id == user_message.id)
    turn = messages[turn_start + 1 :]
    tools_used = [call["name"] for m in turn if isinstance(m, AIMessage) for call in m.tool_calls]

    return ChatResponse(response=_message_text(messages[-1]), thread_id=thread_id, tools_used=tools_used)


# ---------------------------------------------------------------- Hỏi Con

MAX_IMAGE_BYTES = 8 * 1024 * 1024
TELEGRAM_TIMEOUT_SECONDS = 12


def get_analyzer_dep(settings: Annotated[Settings, Depends(get_settings)]) -> Runnable:
    if not settings.llm_api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Backend chưa có {settings.llm_api_key_name}. Điền key vào backend/.env rồi chạy lại server.",
        )
    return get_analyzer()


TELEGRAM_ATTEMPTS = 3
# Giữ tham chiếu để task chạy nền không bị thu hồi giữa chừng.
background_tasks: set[asyncio.Task] = set()


async def notify_family(store: Store, event: dict, summary: str, image: bytes | None) -> bool:
    """Báo cho con qua Telegram, thử lại vài lần. Ghi kết quả vào event."""
    telegram = get_telegram()
    sent = False
    if telegram is not None:
        for attempt in range(1, TELEGRAM_ATTEMPTS + 1):
            try:
                await asyncio.wait_for(telegram.send_alert(event["id"], summary, image), TELEGRAM_TIMEOUT_SECONDS)
                sent = True
                break
            except Exception as e:
                logger.error("Báo con qua Telegram lỗi lần %s, event=%s: %s", attempt, event["id"], e)
    store.update_event({**event, "telegram_sent": sent})
    return sent


@router.post("/ask", response_model=Event)
async def ask(
    analyzer: Annotated[Runnable, Depends(get_analyzer_dep)],
    store: Annotated[Store, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
    image: Annotated[UploadFile | None, File()] = None,
    text: Annotated[str | None, Form(max_length=2000)] = None,
    family_id: Annotated[str, Form(max_length=50)] = "demo",
    thread_id: Annotated[str | None, Form(max_length=100)] = None,
) -> dict:
    """Bố mẹ gửi ảnh hoặc câu hỏi (multipart). Agent phân loại, trả kết quả Đỏ/Vàng/Xanh; Đỏ thì luôn báo con."""
    image_bytes = await image.read() if image else None
    return await run_ask(analyzer, store, settings, text, image_bytes, family_id, thread_id)


@router.post("/ask-json", response_model=Event)
async def ask_json(
    request: AskJsonRequest,
    analyzer: Annotated[Runnable, Depends(get_analyzer_dep)],
    store: Annotated[Store, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    """Như /ask nhưng nhận JSON, ảnh ở dạng base64 (app di động dùng endpoint này)."""
    image_bytes = None
    if request.image_base64:
        try:
            image_bytes = base64.b64decode(request.image_base64.split(",")[-1], validate=True)
        except ValueError:
            raise HTTPException(status_code=422, detail="Ảnh gửi lên bị lỗi, chụp lại giúp con nhé.")
    return await run_ask(analyzer, store, settings, request.text, image_bytes, request.family_id, request.thread_id)


async def run_ask(
    analyzer: Runnable,
    store: Store,
    settings: Settings,
    text: str | None,
    image_bytes: bytes | None,
    family_id: str,
    thread_id: str | None,
) -> dict:
    text = (text or "").strip() or None
    if not text and not image_bytes:
        raise HTTPException(status_code=422, detail="Cần gửi ảnh hoặc câu hỏi.")
    if image_bytes and len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh quá lớn, chụp lại giúp con nhé.")

    thread_id = thread_id or uuid4().hex
    history = store.thread_events(thread_id)
    try:
        analysis = await analyze(analyzer, text, image_bytes, history, settings.parent_title)
    except Exception as e:
        logger.exception("Agent Hỏi Con lỗi, thread_id=%s", thread_id)
        detail = f"Agent lỗi: {e}" if settings.app_env == "development" else "Con chưa xem được, mẹ thử lại nhé."
        raise HTTPException(status_code=502, detail=detail)

    # Luật an toàn bằng code, không tuỳ model: cấp cứu luôn là Đỏ.
    risk = "red" if analysis.kind == "emergency" else analysis.risk
    event_id = "e" + uuid4().hex[:10]
    prescription = None
    if analysis.kind == "prescription" and analysis.prescription_items:
        prescription = {
            "items": [item.model_dump() for item in analysis.prescription_items],
            "questions": [
                {"id": f"q{i + 1}", "text": q.text, "options": ["Đúng", "Không phải"], "item_index": q.item_index}
                for i, q in enumerate(analysis.prescription_questions[:3])
            ],
        }
    event = {
        "id": event_id,
        "family_id": family_id,
        "kind": analysis.kind,
        "risk": risk,
        "confidence": analysis.confidence,
        "title": analysis.title,
        "answer": analysis.answer,
        "actions": analysis.actions,
        "family_notified": False,
        "prescription": prescription,
        "thread_id": thread_id,
        "created_at": now_iso(),
        "question_text": text,
        "image_url": f"/api/v1/events/{event_id}/image" if image_bytes else None,
    }
    if image_bytes:
        store.save_image(event_id, image_bytes)
    store.add_event(event)

    # Luật cứng: kết quả Đỏ LUÔN báo con. Cảnh báo đã nằm trong app của con (GET /events);
    # Telegram là kênh thêm để hiện ngay trên màn hình khoá.
    if risk == "red":
        summary = analysis.alert_summary or analysis.title
        event["family_notified"] = True
        store.update_event(event)
        # Gửi Telegram chạy nền để bố mẹ nhận câu trả lời ngay, không phải chờ mạng Telegram.
        task = asyncio.create_task(notify_family(store, dict(event), summary, image_bytes))
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)
    return event


@router.get("/events", response_model=EventsResponse)
async def events(store: Annotated[Store, Depends(get_store)], family_id: str = "demo") -> dict:
    """Máy Con lấy các câu bố mẹ đã hỏi, mới nhất trước."""
    return {"events": store.list_events(family_id)}


@router.get("/events/{event_id}/image")
async def event_image(event_id: str, store: Annotated[Store, Depends(get_store)]) -> FileResponse:
    path = store.image_path(event_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Không có ảnh.")
    return FileResponse(path, media_type="image/jpeg")


@router.post("/reply", response_model=ReplyOk)
async def reply(
    request: ReplyRequest,
    store: Annotated[Store, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReplyOk:
    """Con trả lời một chạm từ app; máy bố mẹ sẽ lấy về và đọc to."""
    reply_id = store.add_reply(
        request.family_id, request.event_id, request.text, request.from_name or settings.child_name
    )
    return ReplyOk(id=reply_id)


@router.get("/replies", response_model=RepliesResponse)
async def replies(store: Annotated[Store, Depends(get_store)], family_id: str = "demo", after: int = 0) -> dict:
    """Máy của bố mẹ hỏi định kỳ: các câu con vừa trả lời (id lớn hơn `after`)."""
    return {"replies": store.list_replies(family_id, after)}


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm(request: ConfirmRequest, store: Annotated[Store, Depends(get_store)]) -> ConfirmResponse:
    """Bố mẹ xác nhận các chỗ agent đọc chưa chắc trong đơn thuốc; trả lịch uống."""
    event = store.get_event(request.event_id)
    if not event or not event.get("prescription"):
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc.")
    prescription = event["prescription"]
    unsure = {q["item_index"] for q in prescription["questions"] if request.answers.get(q["id"], "Đúng") != "Đúng"}
    schedule, needs_child = [], []
    for i, item in enumerate(prescription["items"]):
        if i in unsure:
            needs_child.append(item["drug"])
        else:
            schedule.append(ScheduleItem(drug=item["drug"], dose=item["dose"], times=item["times"]))
    return ConfirmResponse(schedule=schedule, needs_child=needs_child)


@router.post("/tts", response_model=TtsResponse)
async def tts(
    request: TtsRequest,
    service: Annotated[TtsService, Depends(get_tts)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TtsResponse:
    """Tạo giọng đọc tự nhiên cho một câu; trả mã để tải file WAV ở GET /tts/{id}.wav."""
    if not service.enabled:
        raise HTTPException(status_code=503, detail="Chưa bật giọng đọc.")
    try:
        return TtsResponse(id=await service.synthesize(request.text.strip()))
    except Exception as e:
        logger.exception("Tạo giọng đọc lỗi")
        detail = f"Giọng đọc lỗi: {e}" if settings.app_env == "development" else "Chưa tạo được giọng đọc."
        raise HTTPException(status_code=502, detail=detail) from e


@router.get("/tts/{audio_id}.wav")
async def tts_audio(audio_id: str, service: Annotated[TtsService, Depends(get_tts)]) -> Response:
    audio = service.get(audio_id)
    if audio is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy giọng đọc.")
    return Response(content=audio, media_type="audio/wav")
