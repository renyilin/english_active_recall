import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OpenAI API key not set"
)
def test_tts_full_integration(client: TestClient, auth_headers: dict):
    """
    Full integration test with real OpenAI API.

    This test is skipped unless OPENAI_API_KEY is set in environment.
    """
    # First request - should call OpenAI API
    response1 = client.post(
        "/api/v1/tts",
        json={"text": "Integration test audio"},
        headers=auth_headers,
    )

    assert response1.status_code == 200
    assert response1.headers["content-type"] == "audio/mpeg"
    assert len(response1.content) > 0
    audio_size_1 = len(response1.content)

    # Second request - should use cache
    response2 = client.post(
        "/api/v1/tts",
        json={"text": "Integration test audio"},
        headers=auth_headers,
    )

    assert response2.status_code == 200
    assert len(response2.content) == audio_size_1  # Same audio

    # Different text - should call API again
    response3 = client.post(
        "/api/v1/tts",
        json={"text": "Different text here"},
        headers=auth_headers,
    )

    assert response3.status_code == 200
    assert len(response3.content) > 0
    assert len(response3.content) != audio_size_1  # Different audio


def test_tts_cache_persistence(client: TestClient, auth_headers: dict):
    """Test that cached audio persists across service instances."""
    from unittest.mock import Mock, patch

    # Mock OpenAI to avoid real API calls
    mock_audio = b"test_audio_data"
    mock_response = Mock()
    mock_response.content = mock_audio

    # Patch at the service module level
    with patch('app.services.tts_service.OpenAI') as mock_openai:
        mock_client = Mock()
        mock_openai.return_value = mock_client
        mock_client.audio.speech.create.return_value = mock_response

        # First request
        response1 = client.post(
            "/api/v1/tts",
            json={"text": "Persistence test"},
            headers=auth_headers,
        )
        assert response1.status_code == 200

        # Verify OpenAI was called once
        assert mock_client.audio.speech.create.call_count == 1

        # Second request (should use cache, not call OpenAI again)
        response2 = client.post(
            "/api/v1/tts",
            json={"text": "Persistence test"},
            headers=auth_headers,
        )
        assert response2.status_code == 200

        # Verify OpenAI was NOT called again
        assert mock_client.audio.speech.create.call_count == 1
