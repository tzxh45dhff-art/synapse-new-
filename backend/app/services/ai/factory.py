"""Provider factory — resolves ``settings.AI_PROVIDER`` to a concrete adapter.

Adding Gemini/Voyage/Cohere later means: write the adapter, register it here.
No service changes required.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.ai.base import LLMProvider


@lru_cache(maxsize=None)
def get_provider(name: str | None = None) -> LLMProvider:
    """Return a cached provider instance for ``name`` (defaults to config)."""
    provider = (name or settings.AI_PROVIDER).lower()

    if provider == "openai":
        from app.services.ai.openai_provider import OpenAIProvider

        return OpenAIProvider()

    if provider == "azure":
        from app.services.ai.azure_provider import AzureOpenAIProvider

        return AzureOpenAIProvider()

    if provider == "gemini":
        from app.services.ai.gemini_provider import GeminiProvider

        return GeminiProvider()

    raise ValueError(
        f"Unknown AI provider '{provider}'. "
        "Add an adapter in app/services/ai/ and register it in factory.get_provider."
    )
