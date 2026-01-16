import hashlib
import os
from datetime import datetime
from pathlib import Path
from uuid import UUID

from openai import OpenAI
from sqlmodel import Session, func, select

from app.core.config import get_settings
from app.models.audio_cache import AudioCache

settings = get_settings()


class TTSService:
    """Service for Text-to-Speech with caching."""

    def __init__(self, session: Session):
        self.session = session
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.cache_dir = Path(settings.tts_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def generate_cache_key(text: str, voice: str, model: str) -> str:
        """Generate a deterministic cache key from text, voice, and model."""
        combined = f"{text}|{voice}|{model}"
        return hashlib.sha256(combined.encode()).hexdigest()

    def get_cached_audio(self, cache_key: str) -> AudioCache | None:
        """Get cached audio entry and update access metadata."""
        statement = select(AudioCache).where(AudioCache.cache_key == cache_key)
        cache_entry = self.session.exec(statement).first()

        if cache_entry:
            # Update access metadata
            cache_entry.last_accessed_at = datetime.utcnow()
            cache_entry.access_count += 1
            self.session.add(cache_entry)
            self.session.commit()
            self.session.refresh(cache_entry)

        return cache_entry
