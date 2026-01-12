from fastapi.testclient import TestClient


def test_get_current_user(client: TestClient, auth_headers: dict):
    """Test getting current user info."""
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


def test_get_current_user_unauthorized(client: TestClient):
    """Test accessing user info without auth fails."""
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_get_current_user_invalid_token(client: TestClient):
    """Test accessing user info with invalid token fails."""
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401
