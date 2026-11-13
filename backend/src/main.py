import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from src.api.routes import router
from src.config import get_settings
from src.services.db import apply_schema, create_pool

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Chọn nơi lưu hội thoại: Postgres nếu có DATABASE_URL, ngược lại là RAM."""
    if not settings.database_url:
        app.state.db_pool = None
        app.state.checkpointer = MemorySaver()
        logger.info("Không có DATABASE_URL: lịch sử hội thoại lưu trong RAM.")
        yield
        return

    pool = create_pool(settings.database_url)
    try:
        await pool.open(wait=True, timeout=15)
    except Exception as e:
        await pool.close()
        raise RuntimeError(
            "Không kết nối được Postgres ở DATABASE_URL. Chạy `make db`, hoặc để trống DATABASE_URL để dùng RAM."
        ) from e

    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()
    await apply_schema(pool)
    app.state.db_pool = pool
    app.state.checkpointer = checkpointer
    logger.info("Lịch sử hội thoại lưu trong Postgres.")
    try:
        yield
    finally:
        await pool.close()


is_production = settings.app_env == "production"
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
    # Backend public qua internet: không để lộ tài liệu API ở production.
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health(request: Request, response: Response):
    pool = getattr(request.app.state, "db_pool", None)
    body = {
        "status": "ok",
        "env": settings.app_env,
        "llm_configured": bool(settings.llm_api_key),
        "model": settings.llm_model,
        "fallback_models": settings.fallback_models,
        "storage": "postgres" if pool else "memory",
        "commit": settings.git_sha,
    }
    if pool:
        # Database chết thì báo 503 để bước kiểm tra lúc deploy phát hiện được.
        try:
            async with pool.connection(timeout=3) as conn:
                await conn.execute("SELECT 1")
        except Exception:
            logger.exception("Không kết nối được Postgres")
            response.status_code = 503
            body["status"] = "db_unavailable"
    return body
