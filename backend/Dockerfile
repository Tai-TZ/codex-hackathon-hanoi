# ---- Stage 1: cài thư viện vào một virtualenv ----
FROM python:3.12-slim AS builder

RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: image chạy ----
FROM python:3.12-slim

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    PORT=8000

# Virtualenv nằm ngoài /root để user thường đọc được.
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY . .

# Chạy bằng user thường; /app/data dành cho dữ liệu ghi ra (ví dụ SQLite).
RUN useradd -m appuser && mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ[\"PORT\"]}/health')" || exit 1

# Nhiều dịch vụ (Render, Railway, Fly.io) truyền cổng qua biến PORT.
CMD ["sh", "-c", "exec uvicorn src.main:app --host 0.0.0.0 --port ${PORT}"]
