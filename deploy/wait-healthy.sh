#!/usr/bin/env bash
# Chờ backend trên máy này trả /health 200 (có kiểm tra Postgres), tối đa 60 giây.
set -u
URL="${HEALTH_URL:-http://localhost:8000/health}"
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "$URL" >/dev/null 2>&1; then
    echo "Backend khỏe: $URL"
    exit 0
  fi
  sleep 2
done
echo "Backend không khỏe sau 60 giây: $URL"
curl -sS --max-time 3 "$URL" || true
exit 1
