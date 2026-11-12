# Lệnh chung cho cả app và backend. Chạy từ thư mục gốc.
.PHONY: help install backend app check test ios-sim ios-device health

help:
	@echo "make install     Cài thư viện cho backend và app"
	@echo "make backend     Chạy backend (cổng 8000, tự nạp lại khi sửa code)"
	@echo "make app         Chạy Metro cho app (dùng với simulator hoặc iPhone đã cài bản debug)"
	@echo "make check       Kiểm tra toàn bộ: lint + test backend, typecheck + lint app"
	@echo "make ios-sim     Build và mở app trên simulator"
	@echo "make ios-device  Build bản Release lên iPhone đang cắm vào Mac"
	@echo "make health      Gọi /health của backend local"

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
