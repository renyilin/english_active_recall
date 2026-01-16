import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class AudioCache(SQLModel, table=True):
    """Audio cache for TTS responses."""

    __tablename__ = "audio_cache"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    cache_key: str = Field(max_length=64, unique=True, index=True)
    text: str = Field(max_length=1000)
    voice: str = Field(max_length=50)
    model: str = Field(max_length=50)
    file_size_bytes: int
    file_path: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_accessed_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    access_count: int = Field(default=1)
