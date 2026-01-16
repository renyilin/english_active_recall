import hashlib

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
import tempfile
from pathlib import Path

from sqlmodel import Session, select

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


def test_cleanup_old_cache_entries(session: Session):
    """Test LRU cleanup removes oldest entries when over size limit."""
    # Create temp directory for test
    with tempfile.TemporaryDirectory() as tmpdir:
        # Override cache dir for test
        from app.core.config import get_settings
        settings = get_settings()
        original_cache_dir = settings.tts_cache_dir
        original_max_size = settings.tts_cache_max_size_bytes
        settings.tts_cache_dir = tmpdir
        settings.tts_cache_max_size_bytes = 2000  # 2KB limit

        tts_service = TTSService(session)
        cache_dir = Path(tmpdir)

        # Create 3 cache entries with files (1KB each = 3KB total)
        for i in range(3):
            cache_key = f"key_{i}"
            file_path = cache_dir / f"{cache_key}.mp3"
            file_path.write_bytes(b"x" * 1024)  # 1KB file

            cache_entry = AudioCache(
                id=uuid4(),
                cache_key=cache_key,
                text=f"Text {i}",
                voice="alloy",
                model="tts-1-1106",
                file_size_bytes=1024,
                file_path=str(file_path),
                created_at=datetime.utcnow() - timedelta(hours=3-i),
                last_accessed_at=datetime.utcnow() - timedelta(hours=3-i),
                access_count=1,
            )
            session.add(cache_entry)
        session.commit()

        # Run cleanup (should remove 2 oldest entries to get under 2KB)
        tts_service.cleanup_old_cache_entries()

        # Verify 2 oldest entries are removed (need to remove 1072 bytes, each file is 1024)
        # After removing key_0 (1024 bytes): 2048 bytes remain (still over 2000)
        # After removing key_1 (1024 bytes): 1024 bytes remain (under 2000) ✓
        remaining = session.exec(select(AudioCache)).all()
        assert len(remaining) == 1
        assert remaining[0].cache_key == "key_2"

        # Verify files were deleted
        assert not (cache_dir / "key_0.mp3").exists()
        assert not (cache_dir / "key_1.mp3").exists()
        assert (cache_dir / "key_2.mp3").exists()

        # Restore settings
        settings.tts_cache_dir = original_cache_dir
        settings.tts_cache_max_size_bytes = original_max_size
