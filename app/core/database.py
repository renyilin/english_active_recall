from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings

settings = get_settings()

# Convert postgresql:// to postgresql+psycopg:// for psycopg3 driver
database_url = settings.database_url.replace("postgresql://", "postgresql+psycopg://")

# For Neon serverless with external PgBouncer pooling:
# - Use pool_pre_ping=True for stale connection handling
# - Keep pool_size small since Neon handles pooling externally
engine = create_engine(
    database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
)


def init_db() -> None:
    """Create all tables. Use Alembic migrations in production."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Dependency that provides a database session."""
    with Session(engine) as session:
        yield session
