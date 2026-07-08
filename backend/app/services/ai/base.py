"""Provider-agnostic contracts for embeddings + chat completions.

Adapters implement :class:`LLMProvider`. Services depend only on these types.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import AsyncIterator, Literal, Protocol, TypedDict, runtime_checkable


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(slots=True)
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass(slots=True)
class EmbeddingResult:
    embeddings: list[list[float]]
    model: str
    total_tokens: int


@dataclass(slots=True)
class LLMStreamEvent:
    """One streamed unit from a chat completion.

    ``type == "delta"`` carries an incremental text fragment in ``text``.
    ``type == "done"`` is emitted exactly once at the end and carries final
    ``usage`` (token counts may be zero if the provider omitted them).
    """

    type: Literal["delta", "done"]
    text: str = ""
    usage: TokenUsage = field(default_factory=TokenUsage)


@runtime_checkable
class LLMProvider(Protocol):
    """Abstract AI provider. Never couple services to a concrete vendor."""

    name: str

    async def embed(self, texts: list[str], *, model: str | None = None) -> EmbeddingResult:
        """Embed a batch of texts. Order of output matches order of input."""
        ...

    def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int | None = None,
    ) -> AsyncIterator[LLMStreamEvent]:
        """Stream a chat completion as a sequence of :class:`LLMStreamEvent`."""
        ...
