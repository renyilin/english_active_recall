# TTS Feature Deployment Checklist

## Pre-Deployment

- [ ] Run all tests: `pytest -v`
- [ ] Set `OPENAI_API_KEY` in production environment
- [ ] Create cache directory: `mkdir -p ./cache/tts`
- [ ] Ensure cache directory has write permissions
- [ ] Run database migration: `alembic upgrade head`
- [ ] Verify OpenAI API key has TTS permissions

## Post-Deployment

- [ ] Test TTS endpoint: `curl -X POST /api/v1/tts -d '{"text":"test"}'`
- [ ] Monitor cache size: `du -sh ./cache/tts`
- [ ] Check Postgres `audio_cache` table has entries
- [ ] Verify LRU cleanup runs when cache exceeds 500MB
- [ ] Test frontend audio playback on Study page

## Monitoring

- Watch OpenAI API usage in OpenAI dashboard
- Monitor cache disk usage
- Check `audio_cache` table growth in Postgres
