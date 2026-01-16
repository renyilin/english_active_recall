import hashlib

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from sqlmodel import Session

from app.services.tts_service import TTSService
from app.models.audio_cache import AudioCache


def test_generate_cache_key():
    """Test cache key generation is deterministic and unique."""
    text1 = "Hello world"
    text2 = "Hello world"
    text3 = "Different text"
    voice = "alloy"
    model = "tts-1-1106"

    key1 = TTSService.generate_cache_key(text1, voice, model)
    key2 = TTSService.generate_cache_key(text2, voice, model)
    key3 = TTSService.generate_cache_key(text3, voice, model)

    # Same input = same key
    assert key1 == key2
    # Different input = different key
    assert key1 != key3
    # Key is SHA-256 hex (64 chars)
    assert len(key1) == 64
    assert all(c in '0123456789abcdef' for c in key1)


def test_get_cached_audio_hit(session: Session):
    """Test cache hit updates last_accessed_at and access_count."""
    tts_service = TTSService(session)

    # Create cache entry
    cache_key = "test_key_123"
    cache_entry = AudioCache(
        id=uuid4(),
        cache_key=cache_key,
        text="Test text",
        voice="alloy",
        model="tts-1-1106",
        file_size_bytes=1024,
        file_path="cache/tts/test.mp3",
        created_at=datetime.utcnow() - timedelta(hours=1),
        last_accessed_at=datetime.utcnow() - timedelta(hours=1),
        access_count=1,
    )
    session.add(cache_entry)
    session.commit()

    # Get cached audio
    result = tts_service.get_cached_audio(cache_key)

    assert result is not None
    assert result.cache_key == cache_key
    assert result.access_count == 2
    # last_accessed_at should be updated (within 5 seconds of now)
    assert (datetime.utcnow() - result.last_accessed_at).total_seconds() < 5


def test_get_cached_audio_miss(session: Session):
    """Test cache miss returns None."""
    tts_service = TTSService(session)
    result = tts_service.get_cached_audio("nonexistent_key")
    assert result is None
