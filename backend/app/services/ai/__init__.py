"""AI provider abstraction.

Nothing outside this package should import a vendor SDK directly. Services talk
to the abstract :class:`LLMProvider` interface; swapping providers is a matter of
adding a new adapter and flipping ``settings.AI_PROVIDER``.
"""

from app.services.ai.base import (
    ChatMessage,
    EmbeddingResult,
    LLMProvider,
    LLMStreamEvent,
    TokenUsage,
)
from app.services.ai.factory import get_provider

__all__ = [
    "ChatMessage",
    "EmbeddingResult",
    "LLMProvider",
    "LLMStreamEvent",
    "TokenUsage",
    "get_provider",
]
