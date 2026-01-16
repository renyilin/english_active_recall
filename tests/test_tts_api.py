from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


def test_tts_endpoint_generates_audio(client: TestClient, auth_headers: dict):
    """Test TTS endpoint generates audio and returns file."""
    with patch('app.services.tts_service.TTSService.get_audio') as mock_get_audio:
        # Mock return value
        mock_cache_entry = Mock()
        mock_cache_entry.cache_key = "test_key_abc123"
        mock_cache_entry.file_path = "cache/tts/test.mp3"
        mock_cache_entry.access_count = 1
        mock_get_audio.return_value = mock_cache_entry

        # Create fake audio file
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_file = Path(tmpdir) / "test.mp3"
            fake_file.write_bytes(b"fake_audio_data")
            mock_cache_entry.file_path = str(fake_file)

            response = client.post(
                "/api/v1/tts",
                json={"text": "Hello world"},
                headers=auth_headers,
            )

            assert response.status_code == 200
            assert response.headers["content-type"] == "audio/mpeg"
            assert response.content == b"fake_audio_data"


def test_tts_endpoint_requires_auth(client: TestClient):
    """Test TTS endpoint requires authentication."""
    response = client.post("/api/v1/tts", json={"text": "Hello"})
    assert response.status_code == 401


def test_tts_endpoint_validates_text_length(client: TestClient, auth_headers: dict):
    """Test TTS endpoint validates text length."""
    long_text = "x" * 1001  # Over 1000 char limit
    response = client.post(
        "/api/v1/tts",
        json={"text": long_text},
        headers=auth_headers,
    )
    assert response.status_code == 422
