from io import BytesIO

import openpyxl
from fastapi.testclient import TestClient


def test_export_cards_returns_xlsx(client: TestClient, auth_headers: dict):
    """Test that the export endpoint returns a valid XLSX file."""
    response = client.get("/api/v1/export/cards", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "attachment" in response.headers.get("content-disposition", "")
    # Verify it's a valid XLSX
    wb = openpyxl.load_workbook(BytesIO(response.content))
    ws = wb.active
    headers = [cell.value for cell in ws[1]]
    assert "Word/Phrase" in headers


def test_export_cards_requires_auth(client: TestClient):
    """Test that the export endpoint requires authentication."""
    response = client.get("/api/v1/export/cards")
    assert response.status_code == 401
