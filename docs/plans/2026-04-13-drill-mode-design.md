# Drill Mode — Design Document

**Date:** 2026-04-13
**Status:** Design approved, pending implementation plan

## Problem

Current study flow (Test Mode + Preview Mode) is recognition-leaning: the user sees a stored `cloze_sentence` and recalls the phrase. This closes the *recognition* gap but not the *active production* gap — learners can identify a phrase when prompted but struggle to actually *use* it in speech.

## Goal

Add an **AI Conversation Drill** that forces the learner to produce target phrases out loud inside a natural spoken dialogue with AI, with live coaching and auto-graded SRS updates.

## User Flow

A new **Drill** tab joins Test Mode and Preview Mode on the study nav.

### Setup
- **Mode:** Single-card focus *or* Multi-card scene
- **Card count:** default 10
- **Selection:** Due cards by default; filters by tag / type / difficulty (mirrors Preview Mode)
- **Scene theme** (multi-card mode only): AI picks a coherent scenario weaving in the phrases

### Session UI — Two panels
- **Left (dialogue panel):** Chat-style turns. AI speaks via TTS + shows text. User taps mic (push-to-talk), speaks, sees transcription.
- **Right (coaching panel):** Live feedback per turn — phrase-used check, correction, alternative. Active card + hint ladder trigger.

### Single-card flow
1. AI opens with a scenario line creating a natural opening for the target phrase.
2. User speaks response (Whisper transcribes).
3. Grader LLM evaluates usage; coaching panel updates live.
4. Dialogue driver LLM generates next AI turn, steering toward target if unused.
5. Up to 3 user turns per card.
6. Auto-grade:
   - Phrase used naturally → **Remembered**
   - Used with correction → **Hard**
   - Never produced → **Forgot**
7. Hint ladder (on silence >8s or failed attempt): Chinese meaning → first letter → full phrase. User must still speak it aloud.

### Multi-card scene flow
1. AI picks one scenario covering all selected cards (e.g., "weekend plans" for 8 phrases).
2. Longer free-flowing dialogue (~15–20 turns) steering organically toward each target.
3. Coaching panel tracks all targets; greys out each as successfully used; highlights the currently "active" one.
4. Session ends when all phrases produced or turn cap reached. Unused phrases → **Forgot**.

### Exit/pause
User can end session anytime. Unattempted cards keep existing SRS state (no penalty).

## Backend Architecture

### Endpoints (FastAPI, JWT-scoped)
- `POST /api/v1/drill/session/start` — `{mode, card_ids, scene_theme?}` → session_id + opening AI turn (text + audio URL).
- `POST /api/v1/drill/session/{id}/turn` — multipart user audio → Whisper → grader → dialogue driver → returns `{transcript, feedback, ai_reply_text, ai_reply_audio_url, card_status_updates, hint_level?}`.
- `POST /api/v1/drill/session/{id}/hint` — returns next hint level for active card.
- `POST /api/v1/drill/session/{id}/end` — finalizes SRS updates for all cards in session.
- `GET /api/v1/drill/sessions` — list past sessions (paginated).
- `GET /api/v1/drill/sessions/{id}` — full transcript + turn audio URLs for replay.

### LLM layers (per user turn)
1. **Grader** (fast model, e.g., gpt-4o-mini): Transcript + active target → structured JSON `{used, correct, naturalness, correction?, alternative?}`.
2. **Dialogue driver**: Conversation history + active target + grader result → next AI turn. Instructed to steer toward target if not yet used.

### Reuse
- OpenAI TTS + existing server-side audio cache.
- Existing `Card` grade path — Drill calls the same SRS update as Test Mode.

### New DB tables
- `DrillSession`: id, user_id, mode, scene_theme, started_at, ended_at, summary_json (per-card outcomes).
- `DrillTurn`: id, session_id, turn_index, role (user/ai), text, audio_url, feedback_json, created_at.
- Audio in a new `DRILL_AUDIO_DIR` (mirror TTS cache pattern).
- Retention: deferred; flag for later (audio can grow fast).

## Frontend

### Routes & components
- New route `/drill` with `DrillPage.tsx`.
- New **Drill** tab on study-mode nav.
- `DrillSetup.tsx` — config form.
- `DrillSession.tsx` — two-panel container.
  - `DialoguePanel.tsx` — chat bubbles, mic button, auto-play AI TTS.
  - `CoachingPanel.tsx` — active card, usage checklist, live feedback, hint ladder.
- `DrillHistoryPage.tsx` — past sessions list.
- `DrillReplay.tsx` — read-only transcript + audio playback.

### Audio
- Browser `MediaRecorder` API → webm/opus blob → upload to `/turn` endpoint.
- Push-to-talk mic button (simpler than VAD for MVP).

### State
- Local React state per session; session ID in URL for reload resilience.

## MVP Scope

**Ship in MVP:**
- Single-card mode only
- Text-based coaching (✓ / corrected / missed — no naturalness score yet)
- Hint ladder
- Auto-grading → existing SRS
- Full transcript + audio persistence
- Basic drill history list (no replay UI yet)

**Deferred:**
- Multi-card scene mode
- Session replay UI
- Scene theme customization
- Audio retention/purge policy
- Naturalness scoring

## Open Risks

- **Audio storage growth** — full audio retention will balloon disk use. Needs a purge policy before heavy usage.
- **Latency** — Whisper + grader + dialogue driver + TTS per turn may feel slow. Mitigate by streaming TTS and running grader/driver calls in parallel where possible.
- **Grading reliability** — auto-grading quality depends on grader prompt. Plan to log feedback JSON so we can tune the prompt from real sessions.
