from enum import Enum

from pydantic import BaseModel, Field


class AIProviderEnum(str, Enum):
    """Supported AI providers."""

    OPENAI = "openai"
    GEMINI = "gemini"


class GenerateRequest(BaseModel):
    """Request schema for AI card generation."""

    text: str = Field(min_length=1, max_length=500, description="Raw phrase or sentence to process")
    provider: AIProviderEnum | None = Field(
        default=None, description="AI provider to use (defaults to configured provider)"
    )



class ExtractRequest(BaseModel):
    """Request schema for text extraction."""

    text: str = Field(min_length=1, max_length=5000, description="Raw text to extract from")
    provider: AIProviderEnum | None = Field(
        default=None, description="AI provider to use (defaults to configured provider)"
    )


class GenerateResponse(BaseModel):
    """Response schema for AI card generation."""

    type: str = Field(description="'phrase' or 'sentence'")
    target_text: str = Field(description="The original input text")
    target_meaning: str = Field(description="Chinese meaning")
    context_sentence: str = Field(description="Example sentence using the target")
    context_translation: str = Field(description="Chinese translation of context sentence")
    cloze_sentence: str = Field(description="Context sentence with blank")
    tags: list[str] = Field(description="Suggested tags", default_factory=list)


class ExtractResponse(BaseModel):
    """Response schema for text extraction."""

    candidates: list[str] = Field(description="List of extracted phrases or sentences")
