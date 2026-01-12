# English Active Recall

AI-powered English learning app with Active Recall and Spaced Repetition.

## Local Development

### Backend

```bash
# Navigate to project root
cd /path/to/english_active_recall

# Activate virtual environment
source .venv/bin/activate

# Install dependencies (first time)
pip install -e ".[dev]"

# Copy and configure environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload
```

Backend runs on: http://localhost:8000

### Frontend

```bash
# In a separate terminal, navigate to frontend
cd /path/to/english_active_recall/frontend

# Install dependencies (first time)
npm install

# Start development server
npm run dev
```

Frontend runs on: http://localhost:5173

### Run Tests

```bash
# From project root (with venv activated)
pytest tests/ -v
```

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
# Stop containers
docker-compose down

# Rebuild after code changes
docker-compose up --build -d

# View container status
docker-compose ps

# Access backend shell
docker-compose exec backend bash
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc
