"""Azure OpenAI adapter for :class:`LLMProvider`.

Uses AsyncAzureOpenAI — deployments for both chat and embeddings are
configured via AZURE_OPENAI_DEPLOYMENT / AZURE_EMBEDDING_DEPLOYMENT.
"""

from __future__ import annotations

from typing import AsyncIterator

import structlog
from openai import AsyncAzureOpenAI

from app.core.config import settings
from app.services.ai.base import (
    ChatMessage,
    EmbeddingResult,
    LLMStreamEvent,
    TokenUsage,
)

logger = structlog.get_logger()


class AzureOpenAIProvider:
    name = "azure"

    def __init__(self) -> None:
        if not settings.AZURE_OPENAI_API_KEY:
            logger.warning("ai.azure.missing_api_key")
        self._client = AsyncAzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY or None,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version=settings.AZURE_OPENAI_API_VERSION,
        )

    # ── Embeddings ───────────────────────────────────────────────────────────
    async def embed(self, texts: list[str], *, model: str | None = None) -> EmbeddingResult:
        deployment = settings.AZURE_EMBEDDING_DEPLOYMENT
        if not texts:
            return EmbeddingResult(embeddings=[], model=deployment, total_tokens=0)

        resp = await self._client.embeddings.create(
            model=deployment,
            input=texts,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        ordered = sorted(resp.data, key=lambda d: d.index)
        return EmbeddingResult(
            embeddings=[d.embedding for d in ordered],
            model=deployment,
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
        deployment = settings.AZURE_OPENAI_DEPLOYMENT
        max_tokens = max_tokens or settings.LLM_MAX_OUTPUT_TOKENS

        usage = TokenUsage()
        stream = await self._client.chat.completions.create(
            model=deployment,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
        )
        async for chunk in stream:
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
