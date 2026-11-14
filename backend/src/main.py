import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings
from src.services.telegram import get_telegram

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx ghi cả URL vào log, mà URL của Telegram chứa token của bot.
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Bật vòng nhận nút bấm từ Telegram (long polling) nếu đã cấu hình bot."""
    telegram = get_telegram()
    task = asyncio.create_task(telegram.poll_forever()) if telegram else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "llm_configured": bool(settings.llm_api_key),
        "model": settings.llm_model,
        "telegram_configured": get_telegram() is not None,
        "fallback_models": settings.fallback_models,
    }
