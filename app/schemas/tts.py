from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """Request schema for TTS endpoint."""

    text: str = Field(..., max_length=1000, description="Text to convert to speech")
    voice: str | None = Field(None, max_length=50, description="Voice to use (default: alloy)")
    model: str | None = Field(None, max_length=50, description="Model to use (default: tts-1-1106)")


class TTSResponse(BaseModel):
    """Response schema for TTS endpoint."""

    cache_key: str = Field(..., description="Cache key for the audio")
    cached: bool = Field(..., description="Whether audio was from cache")
