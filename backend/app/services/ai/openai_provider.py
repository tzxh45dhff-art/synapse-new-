"""OpenAI adapter for :class:`LLMProvider`.

The only file allowed to import the ``openai`` SDK. Handles both embeddings and
streaming chat completions with usage accounting.
"""

from __future__ import annotations

from typing import AsyncIterator

import structlog
from openai import AsyncOpenAI

from app.core.config import settings
from app.services.ai.base import (
    ChatMessage,
    EmbeddingResult,
    LLMStreamEvent,
    TokenUsage,
)

logger = structlog.get_logger()


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        if not settings.OPENAI_API_KEY:
            logger.warning("ai.openai.missing_api_key")
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY or None)

    # ── Embeddings ───────────────────────────────────────────────────────────
    async def embed(self, texts: list[str], *, model: str | None = None) -> EmbeddingResult:
        model = model or settings.EMBEDDING_MODEL
        if not texts:
            return EmbeddingResult(embeddings=[], model=model, total_tokens=0)

        resp = await self._client.embeddings.create(
            model=model,
            input=texts,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        # data is returned in input order per the OpenAI contract, but sort
        # defensively on `index` to be safe.
        ordered = sorted(resp.data, key=lambda d: d.index)
        return EmbeddingResult(
            embeddings=[d.embedding for d in ordered],
            model=model,
            total_tokens=resp.usage.total_tokens if resp.usage else 0,
        )

    # ── Chat (streaming) ──────────────────────────────────────────────────────
    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int | None = None,
    ) -> AsyncIterator[LLMStreamEvent]:
        model = model or settings.LLM_CHAT_MODEL
        max_tokens = max_tokens or settings.LLM_MAX_OUTPUT_TOKENS

        usage = TokenUsage()
        stream = await self._client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
        )
        async for chunk in stream:
            # Usage-only chunk (final) has empty choices.
            if chunk.usage:
                usage = TokenUsage(
                    prompt_tokens=chunk.usage.prompt_tokens,
                    completion_tokens=chunk.usage.completion_tokens,
                )
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield LLMStreamEvent(type="delta", text=delta.content)

        yield LLMStreamEvent(type="done", usage=usage)
