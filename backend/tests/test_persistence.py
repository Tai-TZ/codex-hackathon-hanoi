"""Nơi lưu lịch sử hội thoại.

Test tích hợp với Postgres chỉ chạy khi có TEST_DATABASE_URL (CI có sẵn; trên máy thì
`make db` rồi đặt biến này). Không có thì tự bỏ qua.
"""

import os
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

import src.main as main_module
from src.agents.graph import build_graph
from src.config import Settings
from src.services import db as db_module
from src.services.db import apply_schema, create_pool
from tests.conftest import FakeToolCallingModel

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
needs_postgres = pytest.mark.skipif(not TEST_DATABASE_URL, reason="Cần TEST_DATABASE_URL")


async def test_without_database_url_history_is_kept_in_memory(monkeypatch, client):
    monkeypatch.setattr(main_module, "settings", Settings(_env_file=None, database_url=""))
    app = main_module.app

    async with main_module.lifespan(app):
        assert isinstance(app.state.checkpointer, MemorySaver)
        assert app.state.db_pool is None
        response = await client.get("/health")

    assert response.json()["storage"] == "memory"


def test_schema_with_only_comments_is_skipped(tmp_path, monkeypatch):
    schema = tmp_path / "schema.sql"
    schema.write_text("-- chỉ có chú thích\n\n-- CREATE TABLE x (id int);\n", encoding="utf-8")
    monkeypatch.setattr(db_module, "SCHEMA_FILE", schema)

    assert db_module._schema_sql() == ""


@pytest.fixture
async def pool():
    pool = create_pool(TEST_DATABASE_URL)
    await pool.open(wait=True, timeout=10)
    yield pool
    await pool.close()


@needs_postgres
async def test_history_survives_a_new_agent_on_the_same_database(pool):
    thread = {"configurable": {"thread_id": uuid4().hex}}
    saver = AsyncPostgresSaver(pool)
    await saver.setup()
    first = build_graph(FakeToolCallingModel(responses=[AIMessage("Mình nhớ rồi")]), checkpointer=saver)
    await first.ainvoke({"messages": [HumanMessage("Tên mình là Lan")]}, thread)

    # Như khi backend khởi động lại: graph mới, saver mới, cùng database.
    restarted = build_graph(FakeToolCallingModel(responses=[]), checkpointer=AsyncPostgresSaver(pool))
    state = await restarted.aget_state(thread)

    assert [m.content for m in state.values["messages"]] == ["Tên mình là Lan", "Mình nhớ rồi"]


@needs_postgres
async def test_schema_creates_tables_and_can_run_twice(pool, tmp_path, monkeypatch):
    table = f"test_schema_{uuid4().hex[:8]}"
    schema = tmp_path / "schema.sql"
    schema.write_text(f"CREATE TABLE IF NOT EXISTS {table} (id BIGSERIAL PRIMARY KEY, note TEXT);", encoding="utf-8")
    monkeypatch.setattr(db_module, "SCHEMA_FILE", schema)

    await apply_schema(pool)
    await apply_schema(pool)

    async with pool.connection() as conn:
        row = await (await conn.execute("SELECT to_regclass(%s) AS name", (table,))).fetchone()
        await conn.execute(f"DROP TABLE {table}")
    assert row["name"] == table
