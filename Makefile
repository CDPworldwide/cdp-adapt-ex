.PHONY: help install install-backend install-client install-frontend build build-client build-frontend test test-backend test-frontend lint lint-backend lint-fix clean db-check db-create kill-port setup-hooks

PROJECT_ROOT := $(shell pwd)
BACKEND_DIR := $(PROJECT_ROOT)/backend
FRONTEND_DIR := $(PROJECT_ROOT)/frontend
CLIENT_DIR := $(PROJECT_ROOT)/client

help:
	@echo "Available targets:"
	@echo "  install          - Install all dependencies (backend + client + frontend)"
	@echo "  install-backend  - Set up backend Python environment"
	@echo "  install-client   - Install and build API client"
	@echo "  install-frontend - Install frontend dependencies"
	@echo "  build            - Build for production"
	@echo "  build-client     - Build API client package"
	@echo "  build-frontend   - Build Angular frontend"
	@echo "  test             - Run all tests"
	@echo "  test-backend     - Run backend tests"
	@echo "  test-frontend    - Run frontend tests"
	@echo "  load-test        - Run Locust load tests"
	@echo "  lint             - Run linting"
	@echo "  lint-backend     - Run ruff on backend"
	@echo "  lint-fix         - Fix linting issues"
	@echo "  clean            - Clean build artifacts"
	@echo "  db-check         - Check PostgreSQL status"
	@echo "  db-create        - Create CDP database"
	@echo "  setup-hooks      - Install pre-commit hooks"
	@echo "  kill-port        - Kill process on port (PORT=<port>)"

install: install-backend install-client install-frontend

install-backend:
	@echo "Setting up backend environment..."
	@cd $(BACKEND_DIR) && test -d .venv || uv venv
	@echo "Syncing dependencies..."
ifeq ($(shell uname),Darwin)
	@cd $(BACKEND_DIR) && CFLAGS="-I$$(brew --prefix graphviz)/include" LDFLAGS="-L$$(brew --prefix graphviz)/lib" uv sync
else
	@cd $(BACKEND_DIR) && uv sync || (echo "If pygraphviz fails, install graphviz: apt-get install graphviz graphviz-dev" && exit 1)
endif
	@cd $(BACKEND_DIR) && test -f .env || cp .env-example .env
	@echo "Backend setup complete!"

install-client:
	@echo "Setting up client package..."
	@cd $(CLIENT_DIR) && npm install
	@cd $(CLIENT_DIR) && npm run build
	@echo "Client setup complete!"

install-frontend:
	@echo "Setting up frontend environment..."
	@cd $(FRONTEND_DIR) && pnpm install
	@cd $(FRONTEND_DIR) && test -f src/environments/environment.development.ts || cp src/environments/environment-example.ts src/environments/environment.development.ts
	@echo "Frontend setup complete!"

build: build-client build-frontend

build-client:
	@cd $(CLIENT_DIR) && npm run build

build-frontend:
	@cd $(FRONTEND_DIR) && pnpm ng build

test: test-backend test-frontend

test-backend:
	@cd $(BACKEND_DIR) && uv run pytest

test-frontend:
	@cd $(FRONTEND_DIR) && pnpm test:ci

load-test:
	@cd $(BACKEND_DIR) && uv run locust -f tests/load/locustfile.py

lint: lint-backend

lint-backend:
	@cd $(BACKEND_DIR) && uv run ruff check app/

lint-fix:
	@cd $(BACKEND_DIR) && uv run ruff check --fix app/

clean:
	rm -rf $(BACKEND_DIR)/.venv
	rm -rf $(BACKEND_DIR)/__pycache__
	rm -rf $(BACKEND_DIR)/.pytest_cache
	rm -rf $(BACKEND_DIR)/.ruff_cache
	rm -rf $(FRONTEND_DIR)/node_modules
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(FRONTEND_DIR)/.angular

db-check:
	@pg_isready -h localhost -p 5432

db-create:
	@psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE cdp;" || echo "Database may already exist"

kill-port:
	@PID=$$(lsof -t -i:$(PORT) 2>/dev/null || true); \
	if [ -n "$$PID" ]; then \
		echo "Killing process $$PID on port $(PORT)"; \
		kill -9 $$PID 2>/dev/null || true; \
		sleep 1; \
	else \
		echo "No process found on port $(PORT)"; \
	fi

setup-hooks:
	@echo "Installing pre-commit hooks..."
	@uv tool install pre-commit 2>/dev/null || true
	@uv tool run pre-commit install
