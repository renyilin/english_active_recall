# English Active Recall

AI-powered English learning app with Active Recall and Spaced Repetition.

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Copy environment template
cp .env.example .env

# Edit .env with your database URL and secrets

# Run the server
uvicorn app.main:app --reload

# Run tests
pytest tests/ -v
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc
