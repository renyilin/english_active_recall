import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.database import get_session
from app.main import app


@pytest.fixture(name="session")
def session_fixture():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Create a test client with overridden database dependency."""

    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="test_user")
def test_user_fixture(client: TestClient):
    """Create a test user and return credentials."""
    user_data = {
        "email": "test@example.com",
        "password": "testpassword123",
    }
    client.post("/api/v1/auth/register", json=user_data)
    return user_data


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client: TestClient, test_user: dict):
    """Get authentication headers for a test user."""
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user["email"],
            "password": test_user["password"],
        },
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
