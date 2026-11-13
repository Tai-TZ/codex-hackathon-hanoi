"""Kết nối Postgres dùng chung cho cả backend.

- Agent lưu lịch sử hội thoại qua `AsyncPostgresSaver` (bảng do LangGraph tự tạo).
- Bảng của sản phẩm khai báo trong `schema.sql`, chạy mỗi lần backend khởi động.
- Endpoint cần database thì nhận kết nối qua dependency `get_db_conn`.
"""

from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import HTTPException, Request
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

SCHEMA_FILE = Path(__file__).with_name("schema.sql")


def create_pool(database_url: str) -> AsyncConnectionPool:
    # autocommit + dict_row là yêu cầu của AsyncPostgresSaver; prepare_threshold=0 để
    # không vướng prepared statement khi chạy sau PgBouncer.
    return AsyncConnectionPool(
        database_url,
        open=False,
        min_size=1,
        max_size=10,
        kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": 0},
    )


def _schema_sql() -> str:
    """Nội dung schema.sql, trả chuỗi rỗng nếu file chỉ có chú thích."""
    if not SCHEMA_FILE.exists():
        return ""
    sql = SCHEMA_FILE.read_text(encoding="utf-8")
    has_statement = any(line.strip() and not line.strip().startswith("--") for line in sql.splitlines())
    return sql if has_statement else ""


async def apply_schema(pool: AsyncConnectionPool) -> None:
    sql = _schema_sql()
    if not sql:
        return
    async with pool.connection() as conn:
        await conn.execute(sql)


async def get_db_conn(request: Request) -> AsyncIterator[AsyncConnection]:
    """Dependency cho endpoint cần database: `conn: Annotated[AsyncConnection, Depends(get_db_conn)]`."""
    pool: AsyncConnectionPool | None = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(status_code=503, detail="Backend chưa cấu hình DATABASE_URL.")
    async with pool.connection() as conn:
        yield conn
