from io import BytesIO

from fastapi.testclient import TestClient


def test_export_cards_returns_csv(client: TestClient, auth_headers: dict):
    """Test that the export endpoint returns a valid CSV file."""
    response = client.get("/api/v1/export/cards", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers.get("content-disposition", "")
    assert "filename=flashcards_export.csv" in response.headers.get("content-disposition", "")
    content = BytesIO(response.content).getvalue().decode("utf-8-sig")
    headers = content.splitlines()[0].split(",")
    assert "Word/Phrase" in headers


def test_export_cards_requires_auth(client: TestClient):
    """Test that the export endpoint requires authentication."""
    response = client.get("/api/v1/export/cards")
    assert response.status_code == 401
