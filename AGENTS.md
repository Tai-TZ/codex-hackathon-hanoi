# Hướng dẫn cho coding agent (Codex, Claude Code…)

Repo gồm một app di động và một backend. Đọc thêm `README.md` để biết cách chạy.

```
app/       Expo SDK 58, React Native, TypeScript, Expo Router. Có hướng dẫn riêng: app/AGENTS.md
backend/   Python 3.12, FastAPI, LangGraph
Makefile   Lệnh chung, chạy ở thư mục gốc
```

## Trước khi báo xong việc

Chạy `make check` ở thư mục gốc và sửa cho tới khi qua. Lệnh này chạy lint, kiểm tra định dạng và test của backend, rồi typecheck và lint của app.

## App (`app/`)

- Đọc `app/AGENTS.md` trước: API của Expo thay đổi theo từng SDK, không dựa vào trí nhớ.
- Thêm thư viện bằng `npx expo install <tên>`, không dùng `npm install`.
- Thư viện có code native hoặc thay đổi `app.json` cần build lại (`make ios-sim`). Thư mục `app/ios` là tự sinh, không sửa tay và không commit.
- Màn hình nằm trong `app/src/app/` (mỗi file là một route). Component, hook, hàm tiện ích để ngoài thư mục đó: `src/components`, `src/hooks`, `src/lib`.
- Gọi backend qua `src/lib/api.ts`. Không gọi thẳng nhà cung cấp AI từ app và không đặt API key trong app.
- Màu, khoảng cách, font lấy từ `src/constants/theme.ts`; không viết mã màu rải rác trong component.
- Đã cài sẵn: chụp/chọn ảnh, thu nhỏ ảnh, nhận dạng giọng nói, đọc văn bản thành giọng nói, thông báo cục bộ, AsyncStorage, haptics, Reanimated, Skia, linear gradient, glass effect, font Be Vietnam Pro.
- Chữ hiển thị cho người dùng viết bằng tiếng Việt.

## Backend (`backend/`)

- Chạy lệnh Python qua môi trường ảo: `backend/.venv/bin/python`, `backend/.venv/bin/pytest`.
- Cấu hình đọc từ `backend/.env` qua `src/config.py`. Thêm biến mới thì thêm vào `Settings` và `backend/.env.example`. Không đọc `os.environ` trực tiếp.
- Tạo model qua `src/services/llm.py`. Tên model bắt đầu bằng `gemini` dùng Google, bắt đầu bằng `claude` dùng Anthropic, còn lại dùng OpenAI; model dự phòng khai báo ở `LLM_FALLBACK_MODELS`.
- Agent: prompt ở `src/agents/prompts.py`, tool ở `src/agents/tools/` (đăng ký trong `TOOLS`), luồng ở `src/agents/graph.py`.
- Endpoint ở `src/api/routes.py`, schema ở `src/models/schemas.py`. Kiểm tra dữ liệu vào bằng Pydantic.
- Mỗi tool và endpoint mới cần test trong `backend/tests/`. Test dùng LLM giả trong `tests/conftest.py`; không gọi API thật trong test.
- Lỗi phải được log đầy đủ ở server; chỉ trả chi tiết lỗi cho client khi `APP_ENV=development`.
- Thêm thư viện: ghi vào `requirements.txt` rồi `make -C backend install`.

## Quy tắc chung

- Không commit `.env`, API key hay token.
- Commit nhỏ, mô tả rõ thay đổi.
- Giữ thay đổi trong phạm vi được yêu cầu; không tự ý đổi cấu trúc thư mục hay nâng phiên bản thư viện.
