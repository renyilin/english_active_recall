from fastapi.testclient import TestClient


def test_register_user(client: TestClient):
    """Test user registration."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "new@example.com", "password": "password123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new@example.com"
    assert "id" in data
    assert "hashed_password" not in data


def test_register_duplicate_email(client: TestClient, test_user: dict):
    """Test registration with existing email fails."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": test_user["email"], "password": "anotherpassword"},
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]


def test_register_short_password(client: TestClient):
    """Test registration with short password fails."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "short"},
    )
    assert response.status_code == 422  # Validation error


def test_login_success(client: TestClient, test_user: dict):
    """Test successful login."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient, test_user: dict):
    """Test login with wrong password fails."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_login_nonexistent_user(client: TestClient):
    """Test login with nonexistent user fails."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "nonexistent@example.com", "password": "password123"},
    )
    assert response.status_code == 401


def test_refresh_token(client: TestClient, test_user: dict):
    """Test token refresh."""
    # First login to get tokens
    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]},
    )
    tokens = login_response.json()

    # Refresh tokens
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert response.status_code == 200
    new_tokens = response.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["token_type"] == "bearer"


def test_refresh_token_invalid(client: TestClient):
    """Test refresh with invalid token fails."""
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401
