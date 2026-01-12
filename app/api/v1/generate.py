from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser
from app.schemas.generate import GenerateRequest, GenerateResponse
from app.services.ai_service import generate_card_data

router = APIRouter(prefix="/generate", tags=["AI Generation"])


@router.post("", response_model=GenerateResponse)
async def generate(
    request: GenerateRequest,
    current_user: CurrentUser,
) -> GenerateResponse:
    """
    Generate flashcard data from raw text using AI.

    Takes a phrase or sentence and returns structured learning data including:
    - Type classification (phrase/sentence)
    - Chinese meaning
    - Context sentence
    - Context translation
    - Cloze (fill-in-the-blank) sentence

    The user can review and edit this data before creating a card.
    """
    try:
        provider_value = request.provider.value if request.provider else None
        result = await generate_card_data(request.text, provider=provider_value)
        return GenerateResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {str(e)}",
        )
