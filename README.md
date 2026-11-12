# Codex Community Hackathon – Hanoi

Base code: app di động (Expo / React Native) + backend Python (FastAPI + LangGraph agent).

```
app/       App Expo (expo-router). Màn hình chat thử kết nối: src/app/index.tsx
backend/   API FastAPI + agent LangGraph
Makefile   Lệnh chung
```

## Lệnh hay dùng (chạy ở thư mục gốc)

```bash
make install      # lần đầu: cài backend (.venv, .env) và app
make backend      # chạy backend, http://localhost:8000 (tài liệu API ở /docs)
make app          # chạy Metro
make check        # kiểm tra trước khi build: lint + test backend, typecheck + lint app
make ios-sim      # build lên simulator (lần đầu hoặc sau khi thêm thư viện native)
make ios-device   # build bản Release lên iPhone đang cắm vào Mac
```

Điền `LLM_MODEL` và API key tương ứng vào `backend/.env` (xem `backend/.env.example`).

Khi dev, app tự gọi backend ở cổng 8000 trên máy đang chạy Metro, nên simulator và
điện thoại thật cùng wifi đều dùng được mà không cần cấu hình.

Bản Release cài lên điện thoại không có Metro: phải deploy backend lên một URL https,
điền vào `app/.env` (`EXPO_PUBLIC_API_URL=...`) rồi build lại.

## Quy trình để không lỗi khi build nhanh

1. Sửa code, xem ngay trên simulator hoặc iPhone (Metro tự nạp lại).
2. Trước khi build lên iPhone: `make check` phải qua.
3. Chỉ cần build lại native (`make ios-sim` / `make ios-device`) khi thêm thư viện native hoặc sửa `app.json`.
4. Sau mỗi phần chạy được: commit ngay, để có chỗ quay lại nếu phần sau hỏng.

## Sửa agent ở đâu

| Việc | File |
|---|---|
| Prompt hệ thống | `backend/src/agents/prompts.py` |
| Thêm tool | `backend/src/agents/tools/` rồi đưa vào `TOOLS` trong `tools/__init__.py` |
| Luồng agent (graph) | `backend/src/agents/graph.py` |
| Thêm field vào state | `backend/src/agents/state.py` |
| API và schema | `backend/src/api/routes.py`, `backend/src/models/schemas.py` |
| Đổi model | `LLM_MODEL` trong `backend/.env` (model `gemini-*` dùng `GOOGLE_API_KEY`, còn lại dùng `OPENAI_API_KEY`) |

API chính: `POST /api/v1/chat` với `{ "message": "...", "thread_id": null }`, trả về
`{ "response", "thread_id", "tools_used" }`. Gửi lại `thread_id` để agent nhớ ngữ cảnh.
Lịch sử hội thoại đang lưu trong RAM, mất khi restart server.
