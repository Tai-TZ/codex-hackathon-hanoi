# Lệnh chung cho cả app và backend. Chạy từ thư mục gốc.
.PHONY: help install backend app check test ios-sim ios-device health \
	db db-stop db-psql db-backup db-restore server-up server-logs \
	deploy deploy-freeze deploy-unfreeze remote-logs remote-health

# pipefail: lệnh backup lỗi giữa chừng thì báo lỗi, không ra file rỗng.
SHELL := /bin/bash
.SHELLFLAGS := -o pipefail -c

# Docker Compose đọc POSTGRES_PASSWORD từ backend/.env.
COMPOSE := docker compose --env-file backend/.env

# Server chạy backend (PC nhà, vào qua Tailscale). Đổi bằng: make deploy DEPLOY_HOST=<host ssh>
DEPLOY_HOST ?= pc-linux
DEPLOY_DIR ?= ~/codex-hackathon-hanoi

help:
	@echo "make install       Cài thư viện cho backend và app"
	@echo "make backend       Chạy backend (cổng 8000, tự nạp lại khi sửa code)"
	@echo "make app           Chạy Metro cho app (dùng với simulator hoặc iPhone đã cài bản debug)"
	@echo "make check         Kiểm tra toàn bộ: lint + test backend, typecheck + lint app"
	@echo "make ios-sim       Build và mở app trên simulator"
	@echo "make ios-device    Build bản Release lên iPhone đang cắm vào Mac"
	@echo "make health        Gọi /health của backend local"
	@echo ""
	@echo "make db            Bật Postgres trên máy (cổng 5433)"
	@echo "make db-stop       Tắt Postgres"
	@echo "make db-psql       Mở psql vào database"
	@echo "make db-backup     Sao lưu database vào backups/"
	@echo "make db-restore FILE=backups/<file>.sql.gz   Nạp lại bản sao lưu"
	@echo ""
	@echo "make deploy          Deploy ngay commit mới nhất lên server"
	@echo "make deploy-freeze   Tạm dừng tự deploy (trước giờ demo)"
	@echo "make deploy-unfreeze Bật lại tự deploy"
	@echo "make remote-logs     Xem log backend trên server"
	@echo "make remote-health   Gọi /health của backend public (URL trong app/.env)"

install:
	$(MAKE) -C backend install
	cd app && npm install

backend:
	$(MAKE) -C backend run

app:
	cd app && npx expo start

check:
	$(MAKE) -C backend check
	cd app && npm run check
	@echo "Tất cả kiểm tra đều qua."

test:
	$(MAKE) -C backend test

ios-sim:
	cd app && npx expo run:ios

ios-device:
	cd app && npx expo run:ios --device --configuration Release

health:
	@curl -s localhost:8000/health && echo

# ---- Database ----
db:
	$(COMPOSE) up -d --wait db

db-stop:
	$(COMPOSE) stop db

db-psql:
	$(COMPOSE) exec db psql -U app -d app

db-backup:
	@mkdir -p backups
	$(COMPOSE) exec -T db pg_dump -U app -d app --clean --if-exists | gzip > backups/$$(date +%Y%m%d-%H%M%S).sql.gz
	@ls -lh backups | tail -1

db-restore:
	@test -n "$(FILE)" || { echo "Dùng: make db-restore FILE=backups/<file>.sql.gz"; exit 1; }
	gunzip -c "$(FILE)" | $(COMPOSE) exec -T db psql -U app -d app -v ON_ERROR_STOP=1 -q

# ---- Server (chạy trên máy host backend) ----
server-up:
	GIT_SHA=$$(git rev-parse --short HEAD) $(COMPOSE) --profile server up -d --build --wait

server-logs:
	$(COMPOSE) --profile server logs -f --tail=100 backend

# ---- Điều khiển server từ máy mình ----
deploy:
	ssh $(DEPLOY_HOST) 'cd $(DEPLOY_DIR) && deploy/auto-deploy.sh --force'

deploy-freeze:
	ssh $(DEPLOY_HOST) 'touch ~/.vcv-deploy-freeze' && echo "Đã dừng tự deploy."

deploy-unfreeze:
	ssh $(DEPLOY_HOST) 'rm -f ~/.vcv-deploy-freeze' && echo "Đã bật lại tự deploy."

remote-logs:
	ssh -t $(DEPLOY_HOST) 'cd $(DEPLOY_DIR) && make server-logs'

remote-health:
	@url=$$(grep -E '^EXPO_PUBLIC_API_URL=' app/.env 2>/dev/null | cut -d= -f2-); \
	test -n "$$url" || { echo "Chưa có EXPO_PUBLIC_API_URL trong app/.env"; exit 1; }; \
	curl -s --max-time 10 "$$url/health" && echo
