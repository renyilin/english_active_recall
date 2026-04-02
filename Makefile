.PHONY: backend frontend all build deploy test

backend:
	source .venv/bin/activate && uvicorn app.main:app --reload

frontend:
	cd frontend && npm run dev

all:
	@echo "Starting backend and frontend..."
	@make backend & make frontend

build:
	docker compose build --no-cache

deploy:
	bash deploy.sh

test:
	source .venv/bin/activate && pytest tests/ -v
