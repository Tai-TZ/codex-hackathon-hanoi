"""Lưu câu hỏi của bố mẹ (event) và câu trả lời của con (reply) bằng SQLite."""

import json
import sqlite3
import threading
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

from src.config import BACKEND_DIR, get_settings


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        if str(path) != ":memory:":
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self.image_dir = self.path.parent / "images" if str(path) != ":memory:" else None
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._lock = threading.Lock()
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
                seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, family_id TEXT, thread_id TEXT,
                created_at TEXT, data TEXT);
            CREATE TABLE IF NOT EXISTS replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT, family_id TEXT, event_id TEXT, text TEXT,
                from_name TEXT, at TEXT);
            """
        )

    def add_event(self, event: dict) -> None:
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO events (id, family_id, thread_id, created_at, data) VALUES (?,?,?,?,?)",
                (event["id"], event["family_id"], event["thread_id"], event["created_at"], json.dumps(event)),
            )

    def update_event(self, event: dict) -> None:
        with self._lock, self._db:
            self._db.execute("UPDATE events SET data=? WHERE id=?", (json.dumps(event), event["id"]))

    def get_event(self, event_id: str) -> dict | None:
        row = self._db.execute("SELECT data FROM events WHERE id=?", (event_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list_events(self, family_id: str, limit: int = 50) -> list[dict]:
        rows = self._db.execute(
            "SELECT data FROM events WHERE family_id=? ORDER BY seq DESC LIMIT ?", (family_id, limit)
        ).fetchall()
        return [json.loads(r[0]) for r in rows]

    def thread_events(self, thread_id: str, limit: int = 3) -> list[dict]:
        rows = self._db.execute(
            "SELECT data FROM events WHERE thread_id=? ORDER BY seq DESC LIMIT ?", (thread_id, limit)
        ).fetchall()
        return [json.loads(r[0]) for r in reversed(rows)]

    def latest_event_id(self, family_id: str) -> str | None:
        row = self._db.execute(
            "SELECT id FROM events WHERE family_id=? ORDER BY seq DESC LIMIT 1", (family_id,)
        ).fetchone()
        return row[0] if row else None

    def family_of(self, event_id: str) -> str | None:
        row = self._db.execute("SELECT family_id FROM events WHERE id=?", (event_id,)).fetchone()
        return row[0] if row else None

    def add_reply(self, family_id: str, event_id: str, text: str, from_name: str) -> int:
        with self._lock, self._db:
            cur = self._db.execute(
                "INSERT INTO replies (family_id, event_id, text, from_name, at) VALUES (?,?,?,?,?)",
                (family_id, event_id, text, from_name, now_iso()),
            )
            return cur.lastrowid

    def list_replies(self, family_id: str, after: int = 0) -> list[dict]:
        rows = self._db.execute(
            "SELECT id, event_id, text, from_name, at FROM replies WHERE family_id=? AND id>? ORDER BY id",
            (family_id, after),
        ).fetchall()
        return [dict(zip(("id", "event_id", "text", "from_name", "at"), r, strict=True)) for r in rows]

    def save_image(self, event_id: str, content: bytes) -> None:
        if self.image_dir:
            self.image_dir.mkdir(parents=True, exist_ok=True)
            (self.image_dir / f"{event_id}.jpg").write_bytes(content)

    def image_path(self, event_id: str) -> Path | None:
        if not self.image_dir or not event_id.isalnum():
            return None
        path = self.image_dir / f"{event_id}.jpg"
        return path if path.exists() else None


@lru_cache
def get_store() -> Store:
    path = Path(get_settings().db_path)
    return Store(path if path.is_absolute() else BACKEND_DIR / path)
