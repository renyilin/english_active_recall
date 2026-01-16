import hashlib

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

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

    # Create temp file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(b"dummy audio")
        tmp_path = tmp.name

    try:
        # Create cache entry
        cache_key = "test_key_123"
        cache_entry = AudioCache(
            id=uuid4(),
            cache_key=cache_key,
            text="Test text",
            voice="alloy",
            model="tts-1-1106",
            file_size_bytes=1024,
            file_path=tmp_path,
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
    finally:
        if Path(tmp_path).exists():
            Path(tmp_path).unlink()


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


def test_generate_and_cache_audio(session: Session):
    """Test generating audio via OpenAI and caching it."""
    with tempfile.TemporaryDirectory() as tmpdir:
        from app.core.config import get_settings
        settings = get_settings()
        original_cache_dir = settings.tts_cache_dir
        settings.tts_cache_dir = tmpdir

        tts_service = TTSService(session)

        # Mock OpenAI API response
        mock_audio_data = b"fake_mp3_audio_data"
        mock_response = Mock()
        mock_response.content = mock_audio_data

        with patch.object(tts_service.client.audio.speech, 'create', return_value=mock_response):
            text = "Hello world"
            voice = "alloy"
            model = "tts-1-1106"

            result = tts_service.generate_and_cache_audio(text, voice, model)

            # Verify cache entry created
            assert result.text == text
            assert result.voice == voice
            assert result.model == model
            assert result.file_size_bytes == len(mock_audio_data)
            assert result.access_count == 1

            # Verify file exists
            file_path = Path(result.file_path)
            assert file_path.exists()
            assert file_path.read_bytes() == mock_audio_data

        settings.tts_cache_dir = original_cache_dir


def test_get_audio_end_to_end(session: Session):
    """Test complete flow: cache miss, generate, cache hit."""
    with tempfile.TemporaryDirectory() as tmpdir:
        from app.core.config import get_settings
        settings = get_settings()
        original_cache_dir = settings.tts_cache_dir
        settings.tts_cache_dir = tmpdir

        tts_service = TTSService(session)

        mock_audio_data = b"fake_audio"
        mock_response = Mock()
        mock_response.content = mock_audio_data

        with patch.object(tts_service.client.audio.speech, 'create', return_value=mock_response) as mock_create:
            text = "Test sentence"

            # First call: cache miss, should call OpenAI
            audio1 = tts_service.get_audio(text)
            assert audio1 is not None
            assert mock_create.call_count == 1

            # Second call: cache hit, should NOT call OpenAI
            audio2 = tts_service.get_audio(text)
            assert audio2 is not None
            assert mock_create.call_count == 1  # Still 1, not called again

            # Access count incremented
            cache_entry = session.exec(
                select(AudioCache).where(AudioCache.text == text)
            ).first()
            assert cache_entry.access_count == 2

        settings.tts_cache_dir = original_cache_dir


def test_get_cached_audio_file_missing(session: Session):
    """Test cache entry is removed if file is missing."""
    tts_service = TTSService(session)

    # Create cache entry with non-existent file
    cache_key = "missing_file_key"
    cache_entry = AudioCache(
        id=uuid4(),
        cache_key=cache_key,
        text="Test text",
        voice="alloy",
        model="tts-1-1106",
        file_size_bytes=1024,
        file_path="/tmp/nonexistent_file.mp3",
        created_at=datetime.utcnow(),
        last_accessed_at=datetime.utcnow(),
        access_count=1,
    )
    session.add(cache_entry)
    session.commit()

    # Get cached audio - should return None because file is missing
    result = tts_service.get_cached_audio(cache_key)

    assert result is None

    # Verify entry was removed from DB
    db_entry = session.exec(select(AudioCache).where(AudioCache.cache_key == cache_key)).first()
    assert db_entry is None
