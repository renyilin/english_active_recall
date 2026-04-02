# English Active Recall

AI-powered English learning app with Active Recall and Spaced Repetition.

## Features

- **Active Recall:** Test your knowledge with flashcards before seeing the answer
- **Spaced Repetition:** Cards appear at optimal intervals based on your performance
- **Cloud TTS:** High-quality audio pronunciation using OpenAI TTS API with intelligent server-side caching
- **AI-Generated Content:** Create flashcards from text automatically
- **Customizable Study:** Filter by tags, choose study strategies (hardest, random, or by tag)

## Project Design
refer to @/docs/project_design.md

## Make Commands

```bash
make backend    # Run backend dev server (localhost:8000)
make frontend   # Run frontend dev server (localhost:5173)
make all        # Run both in parallel
make build      # Docker build (no cache)
make deploy     # Deploy to production
make test       # Run pytest
```

### First-Time Setup

```bash
# Backend
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env  # Edit with your database URL and secrets
alembic upgrade head

# Frontend
cd frontend && npm install
```

### Environment Variables

Configure your `.env` file with the following variables:

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Secret key for JWT tokens (generate with `openssl rand -hex 32`)
- `REFRESH_SECRET_KEY`: Secret key for refresh tokens
- `OPENAI_API_KEY`: OpenAI API key (required for TTS and AI generation)

**Optional:**
- `TTS_VOICE`: Voice for TTS (default: "alloy")
- `TTS_MODEL`: TTS model (default: "tts-1-1106")
- `TTS_CACHE_MAX_SIZE_BYTES`: Max cache size in bytes (default: 524288000 = 500MB)
- `TTS_CACHE_DIR`: Directory for TTS audio cache (default: "./cache/tts")

## Docker Deployment (Self-Hosted)

### Prerequisites
- Docker and Docker Compose installed
- PostgreSQL database on [Neon.tech](https://neon.tech) (free tier)

### Setup

```bash
# 1. Copy and configure environment
cp .env.example .env

# 2. Edit .env with your settings:
#    - DATABASE_URL: Your Neon.tech connection string
#    - SECRET_KEY: Generate with `openssl rand -hex 32`
#    - REFRESH_SECRET_KEY: Generate another secret
#    - VITE_API_URL: Your server's public IP/domain (for production)

# 3. Build and run containers
docker-compose up --build -d

# 4. Run database migrations (first time only)
docker-compose exec backend alembic upgrade head

# 5. View logs
docker-compose logs -f
```

### Access
- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/v1/docs

### Useful Commands

```bash
docker-compose down              # Stop containers
docker-compose up --build -d     # Rebuild after code changes
docker-compose ps                # View container status
docker-compose exec backend bash # Access backend shell
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

## Database in Production

### Neon.tech

- URL: https://neon.tech