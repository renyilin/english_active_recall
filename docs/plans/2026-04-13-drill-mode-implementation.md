# Drill Mode Implementation Plan (MVP)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship MVP AI Conversation Drill — a new study mode where learners produce target phrases aloud in a voice conversation with AI, with live coaching and auto-graded SRS updates.

**Architecture:** New FastAPI routes under `/api/v1/drill/*` that orchestrate Whisper → grader LLM → dialogue driver LLM → OpenAI TTS per turn. Two new SQLModel tables (`DrillSession`, `DrillTurn`) persist full transcripts + audio URLs. Frontend adds a **Drill** tab with a two-panel session UI (dialogue + coaching) using browser `MediaRecorder` for push-to-talk input. Reuses existing `ai_service`, `tts_service`, TTS cache, and SRS grade path.

**Tech Stack:** FastAPI, SQLModel, Alembic, OpenAI (gpt-4o-mini + whisper-1 + tts-1), React + Vite + MUI, browser MediaRecorder API.

**Design reference:** `docs/plans/2026-04-13-drill-mode-design.md`

**MVP scope (from design doc):**
- Single-card mode only (no multi-card scene)
- Text-based coaching (✓ / corrected / missed)
- Hint ladder (Chinese meaning → first letter → full phrase)
- Auto-grading → existing SRS via `card_service`
- Full transcript + audio persistence
- Basic drill history list (no replay UI yet)

---

## Task 1: DB Models for DrillSession + DrillTurn

**Files:**
- Create: `app/models/drill.py`
- Modify: `app/models/__init__.py` (export new models)

**Step 1: Write the model**

```python
# app/models/drill.py
import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, JSON


class DrillSession(SQLModel, table=True):
    __tablename__ = "drill_session"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    mode: str = Field(default="single")  # "single" | "scene" (scene deferred)
    scene_theme: Optional[str] = None
    card_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    active_card_index: int = Field(default=0)
    turn_count_for_active_card: int = Field(default=0)
    summary_json: dict = Field(default_factory=dict, sa_column=Column(JSON))
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None


class DrillTurn(SQLModel, table=True):
    __tablename__ = "drill_turn"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="drill_session.id", index=True)
    turn_index: int
    role: str  # "user" | "ai"
    text: str
    audio_url: Optional[str] = None
    feedback_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    active_card_id: Optional[uuid.UUID] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

**Step 2: Register models**

Add to `app/models/__init__.py`:
```python
from app.models.drill import DrillSession, DrillTurn  # noqa: F401
```

**Step 3: Commit**

```bash
git add app/models/drill.py app/models/__init__.py
git commit -m "feat(drill): add DrillSession and DrillTurn models"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `alembic/versions/<autogen>_add_drill_tables.py`

**Step 1: Autogenerate migration**

Run: `alembic revision --autogenerate -m "add drill tables"`
Expected: new file in `alembic/versions/` creating `drill_session` and `drill_turn` tables.

**Step 2: Inspect generated file**

Verify columns match Task 1 models (especially JSON columns for `card_ids`, `summary_json`, `feedback_json`). Hand-edit if autogen misses JSON types.

**Step 3: Apply migration**

Run: `alembic upgrade head`
Expected: "Running upgrade ... -> ..., add drill tables" with no errors.

**Step 4: Verify**

Run: `psql $DATABASE_URL -c "\d drill_session" && psql $DATABASE_URL -c "\d drill_turn"`
Expected: both tables present with expected columns.

**Step 5: Commit**

```bash
git add alembic/versions/
git commit -m "feat(drill): add migration for drill tables"
```

---

## Task 3: Drill Schemas (Pydantic)

**Files:**
- Create: `app/schemas/drill.py`

**Step 1: Write schemas**

```python
# app/schemas/drill.py
import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel


class DrillStartRequest(BaseModel):
    mode: Literal["single"] = "single"
    card_ids: list[uuid.UUID]
    scene_theme: Optional[str] = None


class DrillFeedback(BaseModel):
    used: bool
    correct: bool
    correction: Optional[str] = None
    alternative: Optional[str] = None


class DrillTurnResponse(BaseModel):
    transcript: str
    feedback: DrillFeedback
    ai_reply_text: str
    ai_reply_audio_url: str
    card_advanced: bool  # true if we moved to next card
    next_card_id: Optional[uuid.UUID] = None
    session_complete: bool
    hint_level: Optional[int] = None  # 0 = none, 1..3 = ladder


class DrillStartResponse(BaseModel):
    session_id: uuid.UUID
    active_card_id: uuid.UUID
    ai_opening_text: str
    ai_opening_audio_url: str


class DrillHintResponse(BaseModel):
    hint_level: int
    hint_text: str


class DrillSessionSummary(BaseModel):
    id: uuid.UUID
    started_at: datetime
    ended_at: Optional[datetime]
    mode: str
    card_count: int
    outcomes: dict  # {card_id: "Remembered" | "Hard" | "Forgot"}
```

**Step 2: Commit**

```bash
git add app/schemas/drill.py
git commit -m "feat(drill): add drill request/response schemas"
```

---

## Task 4: Grader Prompt + Service

**Files:**
- Create: `app/services/drill_service.py`
- Test: `tests/services/test_drill_grader.py`

**Step 1: Write failing test**

```python
# tests/services/test_drill_grader.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.drill_service import grade_user_turn


@pytest.mark.asyncio
async def test_grade_user_turn_phrase_used_correctly():
    mock_response = '{"used": true, "correct": true, "correction": null, "alternative": null}'
    with patch("app.services.drill_service._call_grader_llm", new=AsyncMock(return_value=mock_response)):
        result = await grade_user_turn(
            transcript="I'm tired, let's call it a day.",
            target_text="call it a day",
            target_meaning="收工",
        )
    assert result.used is True
    assert result.correct is True


@pytest.mark.asyncio
async def test_grade_user_turn_phrase_missing():
    mock_response = '{"used": false, "correct": false, "correction": null, "alternative": "Try using \\"call it a day\\""}'
    with patch("app.services.drill_service._call_grader_llm", new=AsyncMock(return_value=mock_response)):
        result = await grade_user_turn(
            transcript="I'm tired, let's stop.",
            target_text="call it a day",
            target_meaning="收工",
        )
    assert result.used is False
```

**Step 2: Run test — expect FAIL**

Run: `pytest tests/services/test_drill_grader.py -v`
Expected: ImportError / ModuleNotFoundError for `drill_service`.

**Step 3: Implement grader**

```python
# app/services/drill_service.py
import json
from openai import AsyncOpenAI
from app.core.config import settings
from app.schemas.drill import DrillFeedback

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

GRADER_SYSTEM_PROMPT = """You are an English-learning grader. Given a user's spoken transcript and a target phrase they are practicing, return strict JSON evaluating whether they used the target phrase correctly and naturally.

Output schema:
{
  "used": boolean,     // did they use the target phrase (or a close variant)?
  "correct": boolean,  // was it grammatically correct and natural in context?
  "correction": string|null,  // a better version if incorrect
  "alternative": string|null  // a natural sample usage if they didn't use it
}

Output JSON only. No prose."""


async def _call_grader_llm(transcript: str, target_text: str, target_meaning: str) -> str:
    user_msg = f"Target phrase: {target_text}\nMeaning: {target_meaning}\nUser said: {transcript}"
    resp = await _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": GRADER_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    return resp.choices[0].message.content


async def grade_user_turn(transcript: str, target_text: str, target_meaning: str) -> DrillFeedback:
    raw = await _call_grader_llm(transcript, target_text, target_meaning)
    data = json.loads(raw)
    return DrillFeedback(**data)
```

**Step 4: Run test — expect PASS**

Run: `pytest tests/services/test_drill_grader.py -v`
Expected: both tests pass.

**Step 5: Commit**

```bash
git add app/services/drill_service.py tests/services/test_drill_grader.py
git commit -m "feat(drill): add grader LLM service"
```

---

## Task 5: Dialogue Driver Service

**Files:**
- Modify: `app/services/drill_service.py`
- Test: `tests/services/test_drill_dialogue.py`

**Step 1: Write failing test**

```python
# tests/services/test_drill_dialogue.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.drill_service import generate_ai_reply


@pytest.mark.asyncio
async def test_generate_ai_reply_steers_toward_unused_phrase():
    with patch(
        "app.services.drill_service._call_dialogue_llm",
        new=AsyncMock(return_value="How are you feeling after all these meetings?"),
    ):
        reply = await generate_ai_reply(
            history=[{"role": "ai", "text": "Long day, huh?"}, {"role": "user", "text": "Yeah tired."}],
            target_text="call it a day",
            target_meaning="收工",
            target_used=False,
        )
    assert isinstance(reply, str) and len(reply) > 0


@pytest.mark.asyncio
async def test_generate_ai_opening_line():
    from app.services.drill_service import generate_ai_opening
    with patch(
        "app.services.drill_service._call_dialogue_llm",
        new=AsyncMock(return_value="Wow, we've been at this for hours. How are you holding up?"),
    ):
        line = await generate_ai_opening(target_text="call it a day", target_meaning="收工")
    assert isinstance(line, str) and len(line) > 0
```

**Step 2: Run test — expect FAIL**

Run: `pytest tests/services/test_drill_dialogue.py -v`
Expected: ImportError for `generate_ai_reply` / `generate_ai_opening`.

**Step 3: Implement**

Append to `app/services/drill_service.py`:

```python
DIALOGUE_SYSTEM_PROMPT = """You are a friendly English conversation partner for a learner practicing a specific target phrase. Speak naturally in English at ~B2 level. Keep each reply to 1–2 short sentences.

Your job:
- If the user has NOT yet used the target phrase, steer the conversation so a natural opening for the target phrase appears in your NEXT line (without using the phrase yourself).
- If they HAVE used it, respond naturally and wrap up the topic in 1 more turn.
- Never correct them explicitly — the coaching panel handles that.
- Never say "your target phrase is..." — stay in character.

Output ONLY your next line of dialogue. No JSON, no quotes, no stage directions."""


OPENING_SYSTEM_PROMPT = """You are a friendly English conversation partner. Write ONE natural opening line (1–2 sentences, ~B2 level) that creates a realistic context where the user can naturally use the target phrase in their reply. Do NOT use the target phrase yourself. Output only the line."""


async def _call_dialogue_llm(system: str, messages: list[dict]) -> str:
    resp = await _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": system}, *messages],
        temperature=0.7,
        max_tokens=120,
    )
    return resp.choices[0].message.content.strip()


async def generate_ai_opening(target_text: str, target_meaning: str) -> str:
    user_msg = f"Target phrase: {target_text}\nMeaning: {target_meaning}"
    return await _call_dialogue_llm(OPENING_SYSTEM_PROMPT, [{"role": "user", "content": user_msg}])


async def generate_ai_reply(
    history: list[dict], target_text: str, target_meaning: str, target_used: bool
) -> str:
    convo = "\n".join(f"{t['role'].upper()}: {t['text']}" for t in history)
    user_msg = (
        f"Target phrase: {target_text}\nMeaning: {target_meaning}\n"
        f"Target used so far: {target_used}\n\nConversation:\n{convo}\n\nYour next line:"
    )
    return await _call_dialogue_llm(DIALOGUE_SYSTEM_PROMPT, [{"role": "user", "content": user_msg}])
```

**Step 4: Run test — expect PASS**

Run: `pytest tests/services/test_drill_dialogue.py -v`
Expected: both pass.

**Step 5: Commit**

```bash
git add app/services/drill_service.py tests/services/test_drill_dialogue.py
git commit -m "feat(drill): add dialogue driver service"
```

---

## Task 6: Whisper Transcription Helper

**Files:**
- Modify: `app/services/drill_service.py`

**Step 1: Add transcription function**

```python
async def transcribe_audio(audio_bytes: bytes, filename: str = "turn.webm") -> str:
    # OpenAI Whisper via chat-completions SDK; use audio.transcriptions
    resp = await _client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_bytes, "audio/webm"),
        language="en",
    )
    return resp.text.strip()
```

**Step 2: Commit**

```bash
git add app/services/drill_service.py
git commit -m "feat(drill): add whisper transcription helper"
```

---

## Task 7: Drill Audio Storage Helper

**Files:**
- Modify: `app/core/config.py` (add `DRILL_AUDIO_DIR`)
- Create: `app/services/drill_audio.py`

**Step 1: Config**

Add to `app/core/config.py` Settings:
```python
DRILL_AUDIO_DIR: str = "./cache/drill_audio"
```

**Step 2: Storage helper**

```python
# app/services/drill_audio.py
import os
import uuid
from pathlib import Path
from app.core.config import settings

_root = Path(settings.DRILL_AUDIO_DIR)
_root.mkdir(parents=True, exist_ok=True)


def save_user_audio(session_id: uuid.UUID, turn_index: int, data: bytes, ext: str = "webm") -> str:
    sdir = _root / str(session_id)
    sdir.mkdir(parents=True, exist_ok=True)
    path = sdir / f"user_{turn_index}.{ext}"
    path.write_bytes(data)
    return f"/api/v1/drill/audio/{session_id}/user_{turn_index}.{ext}"


def save_ai_audio(session_id: uuid.UUID, turn_index: int, data: bytes, ext: str = "mp3") -> str:
    sdir = _root / str(session_id)
    sdir.mkdir(parents=True, exist_ok=True)
    path = sdir / f"ai_{turn_index}.{ext}"
    path.write_bytes(data)
    return f"/api/v1/drill/audio/{session_id}/ai_{turn_index}.{ext}"


def read_audio(session_id: uuid.UUID, filename: str) -> bytes:
    path = _root / str(session_id) / filename
    if not path.exists() or ".." in filename:
        raise FileNotFoundError(filename)
    return path.read_bytes()
```

**Step 3: Commit**

```bash
git add app/core/config.py app/services/drill_audio.py
git commit -m "feat(drill): add audio storage helper"
```

---

## Task 8: Drill API Routes — Start Session

**Files:**
- Create: `app/api/v1/drill.py`
- Modify: `app/api/router.py` (register router)

**Step 1: Implement start endpoint**

```python
# app/api/v1/drill.py
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.dependencies import get_current_user, get_session
from app.models.user import User
from app.models.card import Card
from app.models.drill import DrillSession, DrillTurn
from app.schemas.drill import (
    DrillStartRequest, DrillStartResponse,
)
from app.services.drill_service import generate_ai_opening
from app.services.tts_service import synthesize_speech
from app.services.drill_audio import save_ai_audio

router = APIRouter(prefix="/drill", tags=["drill"])


@router.post("/session/start", response_model=DrillStartResponse)
async def start_session(
    req: DrillStartRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    if not req.card_ids:
        raise HTTPException(400, "card_ids required")

    cards = db.exec(
        select(Card).where(Card.id.in_(req.card_ids), Card.user_id == user.id)
    ).all()
    if len(cards) != len(req.card_ids):
        raise HTTPException(404, "one or more cards not found")
    card_by_id = {c.id: c for c in cards}

    session = DrillSession(
        user_id=user.id,
        mode=req.mode,
        scene_theme=req.scene_theme,
        card_ids=[str(cid) for cid in req.card_ids],
        active_card_index=0,
        summary_json={},
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    active = card_by_id[req.card_ids[0]]
    opening_text = await generate_ai_opening(active.target_text, active.target_meaning)
    audio_bytes = await synthesize_speech(opening_text)
    audio_url = save_ai_audio(session.id, 0, audio_bytes)

    turn = DrillTurn(
        session_id=session.id,
        turn_index=0,
        role="ai",
        text=opening_text,
        audio_url=audio_url,
        active_card_id=active.id,
    )
    db.add(turn)
    db.commit()

    return DrillStartResponse(
        session_id=session.id,
        active_card_id=active.id,
        ai_opening_text=opening_text,
        ai_opening_audio_url=audio_url,
    )
```

**Step 2: Check `tts_service.synthesize_speech` signature**

Run: `grep -n "def " app/services/tts_service.py | head -20`
If the function is named differently or returns a path/URL instead of bytes, adapt: either read the bytes and pass to `save_ai_audio`, or bypass `save_ai_audio` for AI audio and reuse the existing TTS cache URL directly. Document whichever choice in comment.

**Step 3: Register router**

In `app/api/router.py`:
```python
from app.api.v1 import drill
api_router.include_router(drill.router, prefix="/v1")
```

**Step 4: Smoke-test manually**

Start backend: `make backend`
Run: `curl -X POST http://localhost:8000/api/v1/drill/session/start -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"mode":"single","card_ids":["<card_uuid>"]}'`
Expected: 200 with session_id + opening text + audio URL.

**Step 5: Commit**

```bash
git add app/api/v1/drill.py app/api/router.py
git commit -m "feat(drill): add start session endpoint"
```

---

## Task 9: Drill API — Turn Endpoint

**Files:**
- Modify: `app/api/v1/drill.py`

**Step 1: Implement `/turn`**

```python
from fastapi import UploadFile, File
from app.schemas.drill import DrillTurnResponse, DrillFeedback
from app.services.drill_service import (
    transcribe_audio, grade_user_turn, generate_ai_reply,
)
from app.services.drill_audio import save_user_audio
from app.services.card_service import grade_card  # existing SRS path

MAX_TURNS_PER_CARD = 3


@router.post("/session/{session_id}/turn", response_model=DrillTurnResponse)
async def take_turn(
    session_id: uuid.UUID,
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    session = db.get(DrillSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404, "session not found")
    if session.ended_at:
        raise HTTPException(400, "session already ended")

    active_card_id = uuid.UUID(session.card_ids[session.active_card_index])
    card = db.get(Card, active_card_id)

    # Next turn index
    last_turn = db.exec(
        select(DrillTurn).where(DrillTurn.session_id == session.id)
        .order_by(DrillTurn.turn_index.desc())
    ).first()
    next_idx = (last_turn.turn_index + 1) if last_turn else 0

    # Transcribe
    audio_bytes = await audio.read()
    transcript = await transcribe_audio(audio_bytes)
    user_audio_url = save_user_audio(session.id, next_idx, audio_bytes)

    # Grade
    feedback = await grade_user_turn(transcript, card.target_text, card.target_meaning)

    db.add(DrillTurn(
        session_id=session.id, turn_index=next_idx, role="user",
        text=transcript, audio_url=user_audio_url,
        feedback_json=feedback.model_dump(), active_card_id=card.id,
    ))

    session.turn_count_for_active_card += 1
    card_advanced = False
    session_complete = False
    next_card_id = None

    # Decide outcome for active card
    used_this_turn = feedback.used
    reached_limit = session.turn_count_for_active_card >= MAX_TURNS_PER_CARD

    outcome = None
    if used_this_turn and feedback.correct:
        outcome = "Remembered"
    elif used_this_turn and not feedback.correct:
        outcome = "Hard"
    elif reached_limit:
        outcome = "Forgot"

    if outcome:
        grade_card(db, card.id, outcome)  # reuse SRS path
        session.summary_json = {**session.summary_json, str(card.id): outcome}
        card_advanced = True
        session.active_card_index += 1
        session.turn_count_for_active_card = 0
        if session.active_card_index >= len(session.card_ids):
            session_complete = True
            session.ended_at = datetime.utcnow()
        else:
            next_card_id = uuid.UUID(session.card_ids[session.active_card_index])

    # Generate AI reply
    if session_complete:
        ai_reply = "Nice work — that's the end of this session."
    else:
        next_active_id = next_card_id or card.id
        next_active = db.get(Card, next_active_id)
        history = _history_for_session(db, session.id)
        ai_reply = await generate_ai_reply(
            history=history,
            target_text=next_active.target_text,
            target_meaning=next_active.target_meaning,
            target_used=False if card_advanced else False,
        )

    ai_audio_bytes = await synthesize_speech(ai_reply)
    ai_audio_url = save_ai_audio(session.id, next_idx + 1, ai_audio_bytes)
    db.add(DrillTurn(
        session_id=session.id, turn_index=next_idx + 1, role="ai",
        text=ai_reply, audio_url=ai_audio_url,
        active_card_id=next_card_id or card.id,
    ))

    db.add(session)
    db.commit()

    return DrillTurnResponse(
        transcript=transcript,
        feedback=feedback,
        ai_reply_text=ai_reply,
        ai_reply_audio_url=ai_audio_url,
        card_advanced=card_advanced,
        next_card_id=next_card_id,
        session_complete=session_complete,
        hint_level=None,
    )


def _history_for_session(db: Session, session_id: uuid.UUID) -> list[dict]:
    turns = db.exec(
        select(DrillTurn).where(DrillTurn.session_id == session_id)
        .order_by(DrillTurn.turn_index)
    ).all()
    return [{"role": t.role, "text": t.text} for t in turns]
```

**Step 2: Verify `grade_card` signature**

Run: `grep -n "def grade_card\|def grade\b" app/services/card_service.py`
If the function signature differs (e.g., takes a rating enum), adapt the call. Add a TODO comment if the existing grading fn doesn't accept string labels — write a small shim in this module that maps "Remembered/Hard/Forgot" → the existing enum/rating type.

**Step 3: Commit**

```bash
git add app/api/v1/drill.py
git commit -m "feat(drill): add turn endpoint with grading + auto-SRS"
```

---

## Task 10: Drill API — Hint, End, Audio, History

**Files:**
- Modify: `app/api/v1/drill.py`

**Step 1: Hint endpoint**

```python
from fastapi.responses import Response
from app.schemas.drill import DrillHintResponse, DrillSessionSummary

HINT_LADDER_MAX = 3


@router.post("/session/{session_id}/hint", response_model=DrillHintResponse)
async def next_hint(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    session = db.get(DrillSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404)
    active_card_id = uuid.UUID(session.card_ids[session.active_card_index])
    card = db.get(Card, active_card_id)
    # Derive current hint level from turn_count_for_active_card (1..3)
    level = min(session.turn_count_for_active_card, HINT_LADDER_MAX)
    if level == 1:
        text = card.target_meaning
    elif level == 2:
        text = f"Starts with: {card.target_text[0]}___"
    else:
        text = card.target_text
    return DrillHintResponse(hint_level=level, hint_text=text)
```

**Step 2: End endpoint**

```python
@router.post("/session/{session_id}/end")
async def end_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    session = db.get(DrillSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404)
    if not session.ended_at:
        # Any remaining cards → Forgot
        for i in range(session.active_card_index, len(session.card_ids)):
            cid = uuid.UUID(session.card_ids[i])
            if str(cid) not in session.summary_json:
                grade_card(db, cid, "Forgot")
                session.summary_json[str(cid)] = "Forgot"
        session.ended_at = datetime.utcnow()
        db.add(session)
        db.commit()
    return {"ok": True, "summary": session.summary_json}
```

**Step 3: Audio serving endpoint**

```python
from app.services.drill_audio import read_audio


@router.get("/audio/{session_id}/{filename}")
async def get_audio(
    session_id: uuid.UUID,
    filename: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    session = db.get(DrillSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(404)
    try:
        data = read_audio(session_id, filename)
    except FileNotFoundError:
        raise HTTPException(404)
    media = "audio/mpeg" if filename.endswith(".mp3") else "audio/webm"
    return Response(content=data, media_type=media)
```

**Step 4: History endpoints**

```python
@router.get("/sessions", response_model=list[DrillSessionSummary])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    sessions = db.exec(
        select(DrillSession).where(DrillSession.user_id == user.id)
        .order_by(DrillSession.started_at.desc())
        .limit(50)
    ).all()
    return [
        DrillSessionSummary(
            id=s.id,
            started_at=s.started_at,
            ended_at=s.ended_at,
            mode=s.mode,
            card_count=len(s.card_ids),
            outcomes=s.summary_json,
        )
        for s in sessions
    ]
```

**Step 5: Commit**

```bash
git add app/api/v1/drill.py
git commit -m "feat(drill): add hint, end, audio, and history endpoints"
```

---

## Task 11: Frontend API Client for Drill

**Files:**
- Modify: `frontend/src/api` (find existing axios client)
- Create: `frontend/src/api/drill.ts`

**Step 1: Locate existing API client**

Run: `ls frontend/src/api 2>/dev/null || ls frontend/src/lib 2>/dev/null || grep -rn "axios.create" frontend/src`
Use the same axios instance pattern as existing (e.g., `cards.ts`).

**Step 2: Write client**

```typescript
// frontend/src/api/drill.ts
import { api } from "./client";  // match existing import pattern

export interface DrillFeedback {
  used: boolean;
  correct: boolean;
  correction?: string | null;
  alternative?: string | null;
}

export interface DrillStartResponse {
  session_id: string;
  active_card_id: string;
  ai_opening_text: string;
  ai_opening_audio_url: string;
}

export interface DrillTurnResponse {
  transcript: string;
  feedback: DrillFeedback;
  ai_reply_text: string;
  ai_reply_audio_url: string;
  card_advanced: boolean;
  next_card_id: string | null;
  session_complete: boolean;
  hint_level: number | null;
}

export const drillApi = {
  start: (cardIds: string[]) =>
    api.post<DrillStartResponse>("/drill/session/start", { mode: "single", card_ids: cardIds }).then(r => r.data),
  turn: (sessionId: string, audioBlob: Blob) => {
    const fd = new FormData();
    fd.append("audio", audioBlob, "turn.webm");
    return api.post<DrillTurnResponse>(`/drill/session/${sessionId}/turn`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },
  hint: (sessionId: string) =>
    api.post<{ hint_level: number; hint_text: string }>(`/drill/session/${sessionId}/hint`).then(r => r.data),
  end: (sessionId: string) =>
    api.post(`/drill/session/${sessionId}/end`).then(r => r.data),
  listSessions: () => api.get("/drill/sessions").then(r => r.data),
};
```

**Step 3: Commit**

```bash
git add frontend/src/api/drill.ts
git commit -m "feat(drill): add frontend API client"
```

---

## Task 12: MediaRecorder Hook

**Files:**
- Create: `frontend/src/hooks/useVoiceRecorder.ts`

**Step 1: Implement**

```typescript
// frontend/src/hooks/useVoiceRecorder.ts
import { useCallback, useRef, useState } from "react";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start();
    recorderRef.current = rec;
    setIsRecording(true);
  }, []);

  const stop = useCallback(() =>
    new Promise<Blob>((resolve) => {
      const rec = recorderRef.current;
      if (!rec) return resolve(new Blob());
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        rec.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        resolve(blob);
      };
      rec.stop();
    }), []);

  return { isRecording, start, stop };
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useVoiceRecorder.ts
git commit -m "feat(drill): add MediaRecorder hook for push-to-talk"
```

---

## Task 13: Drill Page + Tab

**Files:**
- Create: `frontend/src/pages/DrillPage.tsx`
- Create: `frontend/src/components/DrillSetup.tsx`
- Create: `frontend/src/components/DrillSession.tsx`
- Create: `frontend/src/components/DialoguePanel.tsx`
- Create: `frontend/src/components/CoachingPanel.tsx`
- Modify: `frontend/src/App.tsx` or router config (add `/drill` route)
- Modify: study-mode nav (find where Test/Preview tabs are declared — likely `StudyPage.tsx` or `Layout.tsx`)

**Step 1: Find nav & routes**

Run:
- `grep -rn "TestPage\|StudyPage\|/test\|/study" frontend/src`
- `grep -rn "Routes\|Route " frontend/src/App.tsx frontend/src/main.tsx`

Identify exact files to modify.

**Step 2: DrillSetup component**

```tsx
// frontend/src/components/DrillSetup.tsx
import { useState } from "react";
import { Button, Stack, TextField } from "@mui/material";

interface Props { onStart: (cardIds: string[]) => void; dueCardIds: string[]; }

export default function DrillSetup({ onStart, dueCardIds }: Props) {
  const [count, setCount] = useState(10);
  return (
    <Stack spacing={2} sx={{ p: 3, maxWidth: 420 }}>
      <TextField
        type="number" label="Card count" value={count}
        onChange={(e) => setCount(Number(e.target.value))}
        inputProps={{ min: 1, max: dueCardIds.length }}
      />
      <Button
        variant="contained"
        disabled={dueCardIds.length === 0}
        onClick={() => onStart(dueCardIds.slice(0, count))}
      >
        Start Drill
      </Button>
    </Stack>
  );
}
```

**Step 3: DialoguePanel**

```tsx
// frontend/src/components/DialoguePanel.tsx
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

export interface ChatTurn { role: "ai" | "user"; text: string; }

interface Props { turns: ChatTurn[]; onUserAudio: (blob: Blob) => void; disabled?: boolean; }

export default function DialoguePanel({ turns, onUserAudio, disabled }: Props) {
  const { isRecording, start, stop } = useVoiceRecorder();
  const toggle = async () => {
    if (!isRecording) await start();
    else { const blob = await stop(); onUserAudio(blob); }
  };
  return (
    <Stack spacing={1} sx={{ height: "100%", p: 2 }}>
      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {turns.map((t, i) => (
          <Paper key={i} sx={{ p: 1.5, mb: 1, bgcolor: t.role === "ai" ? "grey.100" : "primary.light" }}>
            <Typography variant="caption">{t.role === "ai" ? "AI" : "You"}</Typography>
            <Typography>{t.text}</Typography>
          </Paper>
        ))}
      </Box>
      <IconButton
        onClick={toggle}
        disabled={disabled}
        sx={{ alignSelf: "center", bgcolor: isRecording ? "error.main" : "primary.main", color: "white", width: 72, height: 72 }}
      >
        {isRecording ? <StopIcon fontSize="large" /> : <MicIcon fontSize="large" />}
      </IconButton>
    </Stack>
  );
}
```

**Step 4: CoachingPanel**

```tsx
// frontend/src/components/CoachingPanel.tsx
import { Alert, Chip, Divider, Paper, Stack, Typography, Button } from "@mui/material";

interface Props {
  activeCard: { target_text: string; target_meaning: string } | null;
  lastFeedback: { used: boolean; correct: boolean; correction?: string | null; alternative?: string | null } | null;
  hintText: string | null;
  onRequestHint: () => void;
}

export default function CoachingPanel({ activeCard, lastFeedback, hintText, onRequestHint }: Props) {
  return (
    <Stack spacing={2} sx={{ p: 2, height: "100%" }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="overline">Target phrase</Typography>
        <Typography variant="h6">{activeCard?.target_text ?? "-"}</Typography>
        <Typography variant="body2" color="text.secondary">{activeCard?.target_meaning}</Typography>
        <Button size="small" onClick={onRequestHint} sx={{ mt: 1 }}>Need a hint?</Button>
        {hintText && <Alert severity="info" sx={{ mt: 1 }}>{hintText}</Alert>}
      </Paper>
      <Divider />
      <Typography variant="overline">Last turn</Typography>
      {lastFeedback ? (
        <Stack spacing={1}>
          <Chip
            label={lastFeedback.used ? (lastFeedback.correct ? "Used correctly ✓" : "Used — needs fixing") : "Not used yet"}
            color={lastFeedback.used && lastFeedback.correct ? "success" : lastFeedback.used ? "warning" : "default"}
          />
          {lastFeedback.correction && <Alert severity="warning"><b>Better:</b> {lastFeedback.correction}</Alert>}
          {lastFeedback.alternative && <Alert severity="info"><b>Try:</b> {lastFeedback.alternative}</Alert>}
        </Stack>
      ) : <Typography color="text.secondary">Speak your first turn to see feedback.</Typography>}
    </Stack>
  );
}
```

**Step 5: DrillSession orchestrator**

```tsx
// frontend/src/components/DrillSession.tsx
import { Box, Stack } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import DialoguePanel, { ChatTurn } from "./DialoguePanel";
import CoachingPanel from "./CoachingPanel";
import { drillApi, DrillFeedback } from "../api/drill";

interface Props {
  sessionId: string;
  initialTurn: ChatTurn;
  initialAudioUrl: string;
  initialCard: { id: string; target_text: string; target_meaning: string };
  cardsById: Record<string, { target_text: string; target_meaning: string }>;
  onComplete: () => void;
}

export default function DrillSession(props: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([props.initialTurn]);
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const [activeCardId, setActiveCardId] = useState(props.initialCard.id);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = (url: string) => {
    const a = new Audio(url);
    audioRef.current = a;
    a.play().catch(() => {});
  };

  useEffect(() => { playAudio(props.initialAudioUrl); }, [props.initialAudioUrl]);

  const handleAudio = async (blob: Blob) => {
    setBusy(true);
    setHint(null);
    try {
      const res = await drillApi.turn(props.sessionId, blob);
      setTurns(prev => [...prev, { role: "user", text: res.transcript }, { role: "ai", text: res.ai_reply_text }]);
      setFeedback(res.feedback);
      if (res.next_card_id) setActiveCardId(res.next_card_id);
      playAudio(res.ai_reply_audio_url);
      if (res.session_complete) setTimeout(() => props.onComplete(), 1200);
    } finally { setBusy(false); }
  };

  const handleHint = async () => {
    const h = await drillApi.hint(props.sessionId);
    setHint(h.hint_text);
  };

  const activeCard = props.cardsById[activeCardId] ?? props.initialCard;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 380px", height: "calc(100vh - 120px)" }}>
      <DialoguePanel turns={turns} onUserAudio={handleAudio} disabled={busy} />
      <CoachingPanel
        activeCard={activeCard}
        lastFeedback={feedback}
        hintText={hint}
        onRequestHint={handleHint}
      />
    </Box>
  );
}
```

**Step 6: DrillPage**

```tsx
// frontend/src/pages/DrillPage.tsx
import { useEffect, useState } from "react";
import DrillSetup from "../components/DrillSetup";
import DrillSession from "../components/DrillSession";
import { drillApi } from "../api/drill";
import { cardsApi } from "../api/cards"; // or existing module name

export default function DrillPage() {
  const [dueCards, setDueCards] = useState<{ id: string; target_text: string; target_meaning: string }[]>([]);
  const [started, setStarted] = useState<null | {
    sessionId: string; initialTurn: { role: "ai"; text: string };
    initialAudioUrl: string; initialCard: { id: string; target_text: string; target_meaning: string };
  }>(null);

  useEffect(() => {
    // reuse existing "due cards" endpoint used by Test Mode
    cardsApi.getDue().then(setDueCards);
  }, []);

  const cardsById = Object.fromEntries(dueCards.map(c => [c.id, c]));

  const onStart = async (cardIds: string[]) => {
    const res = await drillApi.start(cardIds);
    const first = cardsById[res.active_card_id];
    setStarted({
      sessionId: res.session_id,
      initialTurn: { role: "ai", text: res.ai_opening_text },
      initialAudioUrl: res.ai_opening_audio_url,
      initialCard: { id: res.active_card_id, ...first },
    });
  };

  if (!started) return <DrillSetup dueCardIds={dueCards.map(c => c.id)} onStart={onStart} />;
  return (
    <DrillSession
      sessionId={started.sessionId}
      initialTurn={started.initialTurn}
      initialAudioUrl={started.initialAudioUrl}
      initialCard={started.initialCard}
      cardsById={cardsById}
      onComplete={() => setStarted(null)}
    />
  );
}
```

**Step 7: Route + tab**

- Add `<Route path="/drill" element={<DrillPage />} />` in the router.
- In the existing Test/Preview tab container, add a Drill tab entry pointing to `/drill`.

**Step 8: Manual test**

- Run `make all`.
- Log in, ensure at least one due card exists.
- Click Drill tab → Start → grant mic permission → speak a response → verify:
  - AI reply plays as audio
  - Transcript appears
  - Coaching panel updates
  - Session advances between cards and ends cleanly

**Step 9: Commit**

```bash
git add frontend/src/pages/DrillPage.tsx frontend/src/components/DrillSetup.tsx frontend/src/components/DrillSession.tsx frontend/src/components/DialoguePanel.tsx frontend/src/components/CoachingPanel.tsx frontend/src/App.tsx
git commit -m "feat(drill): add Drill page, session UI, and nav tab"
```

---

## Task 14: Drill History List

**Files:**
- Create: `frontend/src/pages/DrillHistoryPage.tsx`
- Modify: router

**Step 1: Implement**

```tsx
// frontend/src/pages/DrillHistoryPage.tsx
import { useEffect, useState } from "react";
import { List, ListItem, ListItemText, Typography } from "@mui/material";
import { drillApi } from "../api/drill";

export default function DrillHistoryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  useEffect(() => { drillApi.listSessions().then(setSessions); }, []);
  return (
    <>
      <Typography variant="h5" sx={{ p: 2 }}>Drill History</Typography>
      <List>
        {sessions.map(s => (
          <ListItem key={s.id}>
            <ListItemText
              primary={new Date(s.started_at).toLocaleString()}
              secondary={`${s.card_count} cards — ${Object.values(s.outcomes).join(", ") || "incomplete"}`}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
```

**Step 2: Route**

Add `<Route path="/drill/history" element={<DrillHistoryPage />} />` + a "History" link on DrillPage.

**Step 3: Commit**

```bash
git add frontend/src/pages/DrillHistoryPage.tsx frontend/src/App.tsx
git commit -m "feat(drill): add drill history list page"
```

---

## Task 15: End-to-End Smoke Test & Docs

**Files:**
- Modify: `AGENTS.md` (document Drill mode briefly)

**Step 1: Smoke-test checklist**

- [ ] `make test` — all existing tests still pass
- [ ] `alembic upgrade head` — clean apply on fresh DB
- [ ] Start a drill → complete 3 cards → verify SRS `next_review` updated for each
- [ ] End session early → verify remaining cards graded Forgot
- [ ] Visit Drill history → see the session
- [ ] Check `cache/drill_audio/<session_id>/` — user + AI audio files exist

**Step 2: Doc update**

Add a short section to `AGENTS.md` under Features:
```
- **Drill Mode:** Voice conversation with AI to practice active production of target phrases. Auto-grades cards via SRS.
```

**Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document Drill mode feature"
```

---

## Known Follow-ups (post-MVP)

- Multi-card scene mode (AI weaves all targets into one scenario)
- Session replay UI with per-turn audio playback
- Audio retention/purge job (scheduled cleanup of `cache/drill_audio`)
- Streaming TTS for lower turn latency
- Naturalness scoring in grader
- Scene theme presets
