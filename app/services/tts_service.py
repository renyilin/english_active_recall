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

    def cleanup_old_cache_entries(self) -> None:
        """Remove least recently used cache entries to stay under size limit."""
        # Calculate total cache size
        total_size_stmt = select(func.sum(AudioCache.file_size_bytes))
        total_size = self.session.exec(total_size_stmt).one() or 0

        if total_size <= settings.tts_cache_max_size_bytes:
            return  # Under limit, no cleanup needed

        # Calculate how much to remove
        size_to_remove = total_size - settings.tts_cache_max_size_bytes
        removed_size = 0

        # Get oldest entries by last_accessed_at
        stmt = select(AudioCache).order_by(AudioCache.last_accessed_at.asc())
        old_entries = self.session.exec(stmt).all()

        for entry in old_entries:
            if removed_size >= size_to_remove:
                break

            # Delete file from filesystem
            file_path = Path(entry.file_path)
            if file_path.exists():
                file_path.unlink()

            # Delete database record
            self.session.delete(entry)
            removed_size += entry.file_size_bytes

        self.session.commit()

    def generate_and_cache_audio(self, text: str, voice: str, model: str) -> AudioCache:
        """Generate audio via OpenAI TTS API and cache it."""
        # Run cleanup before adding new entry
        self.cleanup_old_cache_entries()

        # Generate cache key and file path
        cache_key = self.generate_cache_key(text, voice, model)
        file_path = self.cache_dir / f"{cache_key}.mp3"

        # Call OpenAI TTS API
        response = self.client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
        )

        # Save audio to file
        audio_data = response.content
        file_path.write_bytes(audio_data)

        # Create cache entry
        cache_entry = AudioCache(
            cache_key=cache_key,
            text=text,
            voice=voice,
            model=model,
            file_size_bytes=len(audio_data),
            file_path=str(file_path),
        )
        self.session.add(cache_entry)
        self.session.commit()
        self.session.refresh(cache_entry)

        return cache_entry

    def get_audio(self, text: str, voice: str | None = None, model: str | None = None) -> AudioCache:
        """Get audio for text (from cache or generate new)."""
        voice = voice or settings.tts_voice
        model = model or settings.tts_model

        # Check cache first
        cache_key = self.generate_cache_key(text, voice, model)
        cache_entry = self.get_cached_audio(cache_key)

        if cache_entry:
            return cache_entry

        # Cache miss: generate and cache
        return self.generate_and_cache_audio(text, voice, model)
