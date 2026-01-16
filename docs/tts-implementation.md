# Cloud TTS Implementation

## Overview

This project uses OpenAI's TTS API (model: `tts-1-1106`) to generate high-quality audio pronunciation for flashcards.

## Architecture

### Backend
- **Endpoint:** `POST /api/v1/tts`
- **Service:** `TTSService` in `app/services/tts_service.py`
- **Cache:** Postgres `audio_cache` table + filesystem at `./cache/tts/`
- **LRU Eviction:** Automatic cleanup when cache exceeds 500MB

### Frontend
- **Component:** `FlashcardDisplay.tsx`
- **Client:** `ttsApi.generateAudio()` in `services/api.ts`
- **Cache:** In-memory blob URLs (per session)

## Configuration

Add to `.env`:

```env
OPENAI_API_KEY=sk-...
TTS_VOICE=alloy
TTS_MODEL=tts-1-1106
TTS_CACHE_MAX_SIZE_BYTES=524288000
TTS_CACHE_DIR=./cache/tts
```

## Cache Strategy

**Server-Side:**
- Audio files stored as `./cache/tts/{sha256_hash}.mp3`
- Metadata in `audio_cache` table (cache_key, file_size, last_accessed_at, etc.)
- LRU cleanup removes oldest files when total size > 500MB

**Client-Side:**
- Blob URLs cached in memory per session
- Cleanup on component unmount

## API Costs

OpenAI TTS pricing: ~$0.015 per 1,000 characters

Typical card sentence: 50-100 characters = $0.0015 per card
With caching, cost is paid only once per unique sentence.

## Testing

```bash
# Unit tests
pytest tests/test_tts_service.py -v

# API tests
pytest tests/test_tts_api.py -v

# Integration tests (requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-... pytest tests/test_tts_integration.py -v
```

## Fallback Behavior

If TTS API fails, frontend falls back to Web Speech API (browser TTS).
