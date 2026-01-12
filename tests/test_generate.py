from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


def test_generate_card_data(client: TestClient, auth_headers: dict):
    """Test generating card data from AI."""
    mock_response = {
        "type": "phrase",
        "target_text": "call it a day",
        "target_meaning": "收工；今天就做到这里",
        "context_sentence": "I'm really tired, let's call it a day.",
        "context_translation": "我很累了，咱们收工吧。",
        "cloze_sentence": "I'm really tired, let's _______.",
    }

    with patch(
        "app.api.v1.generate.generate_card_data", new_callable=AsyncMock
    ) as mock_generate:
        mock_generate.return_value = mock_response

        response = client.post(
            "/api/v1/generate",
            json={"text": "call it a day"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "phrase"
        assert data["target_text"] == "call it a day"
        assert data["target_meaning"] == "收工；今天就做到这里"
        assert "context_sentence" in data
        assert "cloze_sentence" in data


def test_generate_unauthorized(client: TestClient):
    """Test generating without auth fails."""
    response = client.post("/api/v1/generate", json={"text": "test phrase"})
    assert response.status_code == 401


def test_generate_empty_text(client: TestClient, auth_headers: dict):
    """Test generating with empty text fails validation."""
    response = client.post(
        "/api/v1/generate",
        json={"text": ""},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_generate_with_provider_selection(client: TestClient, auth_headers: dict):
    """Test generating with specific provider."""
    mock_response = {
        "type": "sentence",
        "target_text": "The weather is nice today",
        "target_meaning": "今天天气很好",
        "context_sentence": "The weather is nice today.",
        "context_translation": "今天天气很好。",
        "cloze_sentence": "_______.",
    }

    with patch(
        "app.api.v1.generate.generate_card_data", new_callable=AsyncMock
    ) as mock_generate:
        mock_generate.return_value = mock_response

        response = client.post(
            "/api/v1/generate",
            json={"text": "The weather is nice today", "provider": "openai"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        mock_generate.assert_called_once_with("The weather is nice today", provider="openai")


def test_generate_ai_service_error(client: TestClient, auth_headers: dict):
    """Test handling AI service errors."""
    with patch(
        "app.api.v1.generate.generate_card_data", new_callable=AsyncMock
    ) as mock_generate:
        mock_generate.side_effect = Exception("API rate limit exceeded")

        response = client.post(
            "/api/v1/generate",
            json={"text": "test phrase"},
            headers=auth_headers,
        )
        assert response.status_code == 502
        assert "AI service error" in response.json()["detail"]


def test_generate_provider_not_configured(client: TestClient, auth_headers: dict):
    """Test handling when provider is not configured."""
    with patch(
        "app.api.v1.generate.generate_card_data", new_callable=AsyncMock
    ) as mock_generate:
        mock_generate.side_effect = ValueError("OpenAI API key not configured")

        response = client.post(
            "/api/v1/generate",
            json={"text": "test phrase"},
            headers=auth_headers,
        )
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]
