#!/usr/bin/env bash
# Tự deploy backend trên server (PC nhà). systemd timer gọi script này mỗi phút.
#
# Nhánh trên GitHub có commit mới đụng tới backend → sao lưu database → build và chạy lại
# → chờ /health. Lỗi thì quay về commit cũ và không thử lại commit hỏng đó nữa.
#
#   deploy/auto-deploy.sh           # chỉ deploy khi có commit mới
#   deploy/auto-deploy.sh --force   # deploy ngay, kể cả khi đang đóng băng (make deploy)
#
# Biến môi trường: DEPLOY_BRANCH (mặc định main).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
FREEZE_FILE="$HOME/.vcv-deploy-freeze"
FAILED_FILE="$HOME/.vcv-deploy-failed"
LOG_FILE="$HOME/vcv-deploy.log"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG_FILE"; }

# Không cho hai lần deploy chạy chồng nhau.
exec 9>"/tmp/vcv-deploy.lock"
flock -n 9 || exit 0

cd "$REPO_DIR"

if [[ -f "$FREEZE_FILE" && $FORCE -eq 0 ]]; then
  exit 0
fi

git fetch --quiet origin "$BRANCH"
current="$(git rev-parse HEAD)"
target="$(git rev-parse "origin/$BRANCH")"

if [[ $FORCE -eq 0 ]]; then
  [[ "$current" == "$target" ]] && exit 0
  # Commit này đã deploy hỏng một lần: chờ commit sửa lỗi.
  [[ -f "$FAILED_FILE" && "$(cat "$FAILED_FILE")" == "$target" ]] && exit 0
fi

# Chỉ build lại khi commit mới đụng tới phần chạy trên server.
needs_build=1
if [[ $FORCE -eq 0 ]] && git diff --quiet "$current" "$target" -- backend docker-compose.yml deploy Makefile; then
  needs_build=0
fi

log "Deploy $BRANCH ${current:0:7} -> ${target:0:7} (build=$needs_build)"
git reset --quiet --hard "$target"

if [[ $needs_build -eq 0 ]]; then
  log "OK: không đổi backend, giữ nguyên container."
  exit 0
fi

make db-backup >>"$LOG_FILE" 2>&1 || log "Bỏ qua sao lưu (database chưa chạy?)"

if make server-up >>"$LOG_FILE" 2>&1 && deploy/wait-healthy.sh >>"$LOG_FILE" 2>&1; then
  rm -f "$FAILED_FILE"
  log "OK: đang chạy ${target:0:7}"
  exit 0
fi

log "ROLLBACK: ${target:0:7} lỗi, quay về ${current:0:7}"
echo "$target" >"$FAILED_FILE"
git reset --quiet --hard "$current"
if make server-up >>"$LOG_FILE" 2>&1 && deploy/wait-healthy.sh >>"$LOG_FILE" 2>&1; then
  log "ROLLBACK OK: đang chạy ${current:0:7}"
else
  log "ROLLBACK LỖI: backend không lên được, cần xử lý tay (make remote-logs)"
fi
exit 1
