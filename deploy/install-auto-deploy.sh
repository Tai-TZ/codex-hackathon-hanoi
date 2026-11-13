#!/usr/bin/env bash
# Cài timer tự deploy (systemd của user, không cần sudo) trên server. Chạy một lần:
#
#   deploy/install-auto-deploy.sh            # theo dõi nhánh main
#   DEPLOY_BRANCH=<nhánh> deploy/install-auto-deploy.sh
#
# Gỡ: systemctl --user disable --now vcv-deploy.timer
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"

cat >"$UNIT_DIR/vcv-deploy.service" <<EOF
[Unit]
Description=Tự deploy backend hackathon VCV từ GitHub

[Service]
Type=oneshot
Environment=DEPLOY_BRANCH=$BRANCH
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=$REPO_DIR/deploy/auto-deploy.sh
EOF

cat >"$UNIT_DIR/vcv-deploy.timer" <<EOF
[Unit]
Description=Kiểm tra commit mới mỗi phút

[Timer]
OnBootSec=1min
OnUnitInactiveSec=1min

[Install]
WantedBy=timers.target
EOF

# Timer vẫn chạy khi không có phiên đăng nhập nào.
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now vcv-deploy.timer
echo "Đã cài timer tự deploy, theo dõi nhánh $BRANCH. Log: ~/vcv-deploy.log"
systemctl --user list-timers vcv-deploy.timer --no-pager
