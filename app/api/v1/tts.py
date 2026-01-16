from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.core.database import get_session
from app.dependencies import CurrentUser
from app.schemas.tts import TTSRequest
from app.services.tts_service import TTSService

router = APIRouter(prefix="/tts", tags=["TTS"])


@router.post("", response_class=FileResponse)
async def generate_speech(
    request: TTSRequest,
    current_user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> FileResponse:
    """
    Generate speech audio for the given text.

    Returns MP3 audio file. Uses cached audio if available, otherwise generates via OpenAI TTS.
    """
    tts_service = TTSService(session)

    print(f"TTS called with text: {request.text}")  # Debug: Print error to console

    try:
        cache_entry = tts_service.get_audio(
            text=request.text,
            voice=request.voice,
            model=request.model,
        )
    except Exception as e:
        print(f"TTS Error: {str(e)}", flush=True)  # Debug: Print error to console
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audio: {str(e)}",
        )
    
    print(f"TTS success 2")  # Debug: Print error to console

    file_path = Path(cache_entry.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio file not found",
        )

    print(f"TTS success with text: {request.text}")  # Debug: Print error to console

    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=f"{cache_entry.cache_key}.mp3",
    )
