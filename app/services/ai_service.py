from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are an intelligent data processor for an English learning app.

Instructions:
1. Analyze input: Is it a "phrase" or "sentence"?
2. Generate target_meaning (Simplified Chinese).
3. Generate context_sentence:
   - If Phrase: Create a natural example sentence using it.
   - If Sentence: Use input as-is (correct grammar if needed).
4. Generate context_translation: Translate the full example sentence (Simplified Chinese).
5. Generate cloze_sentence: Replace target in context with "_______".
6. Generate tags: Select the most relevant tag ONLY from this list: ['sport', 'travel', 'life', 'health', 'shopping', 'food', 'people', 'work', 'weather', 'tech']. Return empty list if none apply.
7. Output JSON only.

Output format (strict JSON, no markdown):
{
  "type": "phrase" or "sentence",
  "target_text": "the exact input phrase/sentence",
  "target_meaning": "Chinese meaning",
  "context_sentence": "Natural example sentence in English",
  "context_translation": "Chinese translation of context_sentence",
  "cloze_sentence": "Context sentence with _______ replacing target",
  "tags": ["tag1"]
}"""

EXTRACT_SYSTEM_PROMPT = """You are an expert English language content analyzer.

Instructions:
1. Analyze the input text.
2. Extract useful English phrases, idioms, or sentences for a learner to study.
3. Ignore common simple words or irrelevant content.
4. Limit to the top 20 most valuable items.
5. maintain the original text for each item.

Output format (strict JSON):
{
  "candidates": [
    "extracted phrase 1",
    "extracted sentence 2"
  ]
}"""


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    @abstractmethod
    async def generate(self, text: str) -> dict[str, Any]:
        """Generate card data from raw text input."""
        pass

    @abstractmethod
    async def extract_candidates(self, text: str) -> list[str]:
        """Extract learning candidates from text."""
        pass


class OpenAIProvider(AIProvider):
    """OpenAI API provider."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://api.openai.com/v1/chat/completions"

    async def generate(self, text: str) -> dict[str, Any]:
        """Generate card data using OpenAI API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            import json

            content = data["choices"][0]["message"]["content"]
            return json.loads(content)

    async def extract_candidates(self, text: str) -> list[str]:
        """Extract candidates using OpenAI API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": EXTRACT_SYSTEM_PROMPT},
                        {"role": "user", "content": text},
                    ],
                    "temperature": 0.5,
                    "response_format": {"type": "json_object"},
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            import json

            content = data["choices"][0]["message"]["content"]
            result = json.loads(content)
            return result.get("candidates", [])


class GeminiProvider(AIProvider):
    """Google Gemini API provider."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    async def generate(self, text: str) -> dict[str, Any]:
        """Generate card data using Gemini API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": f"{SYSTEM_PROMPT}\n\nInput: {text}"},
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.7,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            import json

            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(content)

    async def extract_candidates(self, text: str) -> list[str]:
        """Extract candidates using Gemini API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": f"{EXTRACT_SYSTEM_PROMPT}\n\nInput: {text}"},
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.5,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            import json

            content = data["candidates"][0]["content"]["parts"][0]["text"]
            result = json.loads(content)
            return result.get("candidates", [])



class AIServiceFactory:
    """Factory for creating AI provider instances."""

    @staticmethod
    def create(provider: str | None = None) -> AIProvider:
        """Create an AI provider instance based on configuration."""
        provider_name = provider or settings.ai_provider

        if provider_name == "openai":
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            return OpenAIProvider(settings.openai_api_key)
        elif provider_name == "gemini":
            if not settings.gemini_api_key:
                raise ValueError("Gemini API key not configured")
            return GeminiProvider(settings.gemini_api_key)
        else:
            raise ValueError(f"Unknown AI provider: {provider_name}")


async def generate_card_data(text: str, provider: str | None = None) -> dict[str, Any]:
    """Generate card data from raw text input using configured AI provider."""
    ai_provider = AIServiceFactory.create(provider)
    return await ai_provider.generate(text)


async def extract_learning_items(text: str, provider: str | None = None) -> list[str]:
    """Extract learning items from raw text input using configured AI provider."""
    ai_provider = AIServiceFactory.create(provider)
    return await ai_provider.extract_candidates(text)
