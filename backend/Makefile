.PHONY: install run test lint format check clean

VENV := .venv
BIN := $(VENV)/bin

install:
	uv venv --python 3.12 $(VENV)
	uv pip install --python $(BIN)/python -r requirements.txt
	@test -f .env || cp .env.example .env

# --host 0.0.0.0 để điện thoại thật trong cùng wifi gọi được
run:
	$(BIN)/uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

test:
	$(BIN)/pytest -v

lint:
	$(BIN)/ruff check src/ tests/

format:
	$(BIN)/ruff format src/ tests/

check: lint test
	$(BIN)/ruff format --check src/ tests/

clean:
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} +
