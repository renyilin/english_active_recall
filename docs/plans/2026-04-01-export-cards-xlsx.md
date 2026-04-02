# Export Cards to XLSX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Export" button in the top menu bar (beside the username) that exports all of the user's phrases and words to a `.xlsx` file.

**Architecture:** Backend generates the XLSX file using `openpyxl` and returns it as a streaming response. Frontend triggers a download via an axios blob request. The export endpoint fetches all cards (no pagination) for the authenticated user, including their tags, and writes them into a single Excel sheet.

**Tech Stack:** `openpyxl` (backend XLSX generation), axios blob response (frontend download), MUI `IconButton` + `FileDownload` icon (UI)

---

### Task 1: Add `openpyxl` backend dependency

**Files:**
- Modify: `pyproject.toml:7-31` (dependencies list)

**Step 1: Add openpyxl to dependencies**

In `pyproject.toml`, add `"openpyxl>=3.1.0",` to the `dependencies` list after the OpenAI entry:

```toml
    # OpenAI TTS
    "openai>=1.57.0",

    # Excel export
    "openpyxl>=3.1.0",
```

**Step 2: Install the dependency**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall && pip install -e ".[dev]"`
Expected: Successfully installed openpyxl

**Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "feat: add openpyxl dependency for XLSX export"
```

---

### Task 2: Create the export service

**Files:**
- Create: `app/services/export_service.py`
- Test: `tests/services/test_export_service.py`

**Step 1: Write the failing test**

Create `tests/services/test_export_service.py`:

```python
import uuid
from datetime import datetime
from io import BytesIO
from unittest.mock import MagicMock

import openpyxl
import pytest

from app.services.export_service import ExportService


def _make_mock_card(
    target_text="hello",
    target_meaning="greeting",
    card_type="phrase",
    context_sentence="Hello, how are you?",
    context_translation="Translation here",
    cloze_sentence="___, how are you?",
    tags=None,
    interval=1,
    ease_factor=2.5,
    next_review=None,
    created_at=None,
):
    card = MagicMock()
    card.type = card_type
    card.target_text = target_text
    card.target_meaning = target_meaning
    card.context_sentence = context_sentence
    card.context_translation = context_translation
    card.cloze_sentence = cloze_sentence
    card.interval = interval
    card.ease_factor = ease_factor
    card.next_review = next_review or datetime(2026, 4, 1)
    card.created_at = created_at or datetime(2026, 3, 1)
    card.tags = tags or []
    return card


def _make_mock_tag(name):
    tag = MagicMock()
    tag.name = name
    return tag


class TestExportService:
    def test_generates_xlsx_with_headers(self):
        service = ExportService()
        buf = service.cards_to_xlsx([])
        wb = openpyxl.load_workbook(buf)
        ws = wb.active
        headers = [cell.value for cell in ws[1]]
        assert headers == [
            "Type",
            "Word/Phrase",
            "Meaning",
            "Context Sentence",
            "Context Translation",
            "Cloze Sentence",
            "Tags",
            "Interval (days)",
            "Ease Factor",
            "Next Review",
            "Created At",
        ]

    def test_generates_xlsx_with_card_data(self):
        tag1 = _make_mock_tag("greetings")
        tag2 = _make_mock_tag("basics")
        card = _make_mock_card(tags=[tag1, tag2])
        service = ExportService()
        buf = service.cards_to_xlsx([card])
        wb = openpyxl.load_workbook(buf)
        ws = wb.active
        row = [cell.value for cell in ws[2]]
        assert row[0] == "phrase"
        assert row[1] == "hello"
        assert row[2] == "greeting"
        assert row[3] == "Hello, how are you?"
        assert row[4] == "Translation here"
        assert row[5] == "___, how are you?"
        assert row[6] == "greetings, basics"
        assert row[7] == 1
        assert row[8] == 2.5

    def test_generates_xlsx_with_multiple_cards(self):
        cards = [_make_mock_card(target_text=f"word{i}") for i in range(3)]
        service = ExportService()
        buf = service.cards_to_xlsx(cards)
        wb = openpyxl.load_workbook(buf)
        ws = wb.active
        assert ws.max_row == 4  # 1 header + 3 data rows

    def test_returns_bytes_io(self):
        service = ExportService()
        buf = service.cards_to_xlsx([])
        assert isinstance(buf, BytesIO)
        assert buf.tell() == 0  # seek position reset to start
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall && python -m pytest tests/services/test_export_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.export_service'`

**Step 3: Write the implementation**

Create `app/services/export_service.py`:

```python
from io import BytesIO

from openpyxl import Workbook


HEADERS = [
    "Type",
    "Word/Phrase",
    "Meaning",
    "Context Sentence",
    "Context Translation",
    "Cloze Sentence",
    "Tags",
    "Interval (days)",
    "Ease Factor",
    "Next Review",
    "Created At",
]


class ExportService:
    """Service to export cards to XLSX format."""

    def cards_to_xlsx(self, cards: list) -> BytesIO:
        """Convert a list of Card objects to an XLSX file in memory."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Cards"

        ws.append(HEADERS)

        for card in cards:
            tags_str = ", ".join(tag.name for tag in card.tags)
            ws.append([
                card.type,
                card.target_text,
                card.target_meaning,
                card.context_sentence,
                card.context_translation,
                card.cloze_sentence,
                tags_str,
                card.interval,
                card.ease_factor,
                card.next_review.strftime("%Y-%m-%d %H:%M"),
                card.created_at.strftime("%Y-%m-%d %H:%M"),
            ])

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall && python -m pytest tests/services/test_export_service.py -v`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add app/services/export_service.py tests/services/test_export_service.py
git commit -m "feat: add ExportService to generate XLSX from cards"
```

---

### Task 3: Create the export API endpoint

**Files:**
- Create: `app/api/v1/export.py`
- Modify: `app/api/router.py:1-14` (register new router)
- Test: `tests/api/test_export.py`

**Step 1: Write the failing test**

Create `tests/api/test_export.py`:

```python
import openpyxl
from io import BytesIO

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
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall && python -m pytest tests/api/test_export.py -v`
Expected: FAIL (endpoint does not exist yet)

> **Note:** This test depends on existing test fixtures (`client`, `auth_headers`). Check `tests/conftest.py` for how they are defined. If they don't exist, you may need to adapt. The key logic is: make a GET to `/api/v1/export/cards` with a valid auth token.

**Step 3: Write the endpoint**

Create `app/api/v1/export.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.core.database import get_session
from app.dependencies import CurrentUser
from app.models.card import Card
from app.services.export_service import ExportService

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/cards")
async def export_cards(
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> StreamingResponse:
    """Export all cards for the current user as an XLSX file."""
    statement = (
        select(Card)
        .where(Card.user_id == current_user.id)
        .order_by(Card.created_at.desc())
    )
    cards = list(session.exec(statement).all())

    export_service = ExportService()
    xlsx_buf = export_service.cards_to_xlsx(cards)

    return StreamingResponse(
        xlsx_buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=flashcards_export.xlsx"
        },
    )
```

**Step 4: Register the router**

In `app/api/router.py`, add the import and include:

```python
from app.api.v1 import auth, cards, export, generate, health, tags, tts, users

api_router = APIRouter()

# Include all v1 routers
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(cards.router)
api_router.include_router(tags.router)
api_router.include_router(generate.router)
api_router.include_router(tts.router)
api_router.include_router(export.router)
```

**Step 5: Run test to verify it passes**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall && python -m pytest tests/api/test_export.py -v`
Expected: Both tests PASS

**Step 6: Commit**

```bash
git add app/api/v1/export.py app/api/router.py tests/api/test_export.py
git commit -m "feat: add GET /export/cards endpoint returning XLSX"
```

---

### Task 4: Add export API call to frontend service layer

**Files:**
- Modify: `frontend/src/services/api.ts:97-107` (add exportApi)

**Step 1: Add the export API function**

In `frontend/src/services/api.ts`, add after the `ttsApi` block (after line 107):

```typescript
// Export API
export const exportApi = {
  exportCards: async (): Promise<Blob> => {
    const response = await api.get('/export/cards', {
      responseType: 'blob',
    });
    return response.data;
  },
};
```

**Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add exportApi to frontend service layer"
```

---

### Task 5: Add Export button to the top menu bar

**Files:**
- Modify: `frontend/src/components/Layout.tsx:1-107`

**Step 1: Add the Export button beside the username**

Update `Layout.tsx` with these changes:

1. Add import for `FileDownload` icon and `useState`:
```typescript
import { useState } from 'react';
// ... existing imports ...
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { exportApi } from '../services/api';
```

2. Add export handler inside the `Layout` component (after line 35):
```typescript
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportApi.exportCards();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flashcards_export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };
```

3. Add the Export button between the username and logout button (between lines 75 and 76):
```tsx
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.email}
          </Typography>
          <IconButton
            color="inherit"
            onClick={handleExport}
            disabled={exporting}
            title="Export to Excel"
          >
            <FileDownloadIcon />
          </IconButton>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutIcon />
          </IconButton>
```

**Step 2: Verify manually**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall/frontend && npm run dev`
- Navigate to the app in browser
- Verify the download icon appears between the username and logout button
- Click the export button and verify an `.xlsx` file downloads
- Open the file in a spreadsheet app and verify columns/data are correct

**Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: add Export button to top menu bar"
```

---

### Task 6: Run all tests and verify

**Step 1: Run backend tests**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall && python -m pytest tests/ -v`
Expected: All tests PASS (existing + new)

**Step 2: Run frontend type check**

Run: `cd /Users/ryl/Documents/workspace/english_active_recall/frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Fix any issues found, then commit if needed**
