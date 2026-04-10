from fastapi import APIRouter, HTTPException, status

from app.dependencies import CurrentUser
from app.schemas.generate import (
    ExtractRequest,
    ExtractResponse,
    GenerateRequest,
    GenerateResponse,
    RecommendRequest,
    RecommendResponse,
)
from app.services.ai_service import extract_learning_items, generate_card_data, recommend_related_items

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


@router.post("/extract", response_model=ExtractResponse)
async def extract(
    request: ExtractRequest,
    current_user: CurrentUser,
) -> ExtractResponse:
    """
    Extract useful English phrases or sentences from larger text.
    """
    try:
        provider_value = request.provider.value if request.provider else None
        candidates = await extract_learning_items(request.text, provider=provider_value)
        return ExtractResponse(candidates=candidates)
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


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    request: RecommendRequest,
    current_user: CurrentUser,
) -> RecommendResponse:
    """
    Recommend 5 related phrases or sentences based on a source text.
    Excludes items already in the user's library.
    """
    try:
        provider_value = request.provider.value if request.provider else None
        items = await recommend_related_items(
            request.text,
            existing_texts=request.existing_texts,
            provider=provider_value,
        )
        recommendations = [GenerateResponse(**item) for item in items]
        return RecommendResponse(recommendations=recommendations)
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
