"""Gemini provider using native async HTTP requests (httpx) to avoid blocking or package reload issues."""

from __future__ import annotations

import json
from typing import AsyncIterator

import httpx
import structlog

from app.core.config import settings
from app.services.ai.base import (
    ChatMessage,
    EmbeddingResult,
    LLMStreamEvent,
    TokenUsage,
)

logger = structlog.get_logger()


class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            logger.warning("ai.gemini.missing_api_key")

    async def embed(self, texts: list[str], *, model: str | None = None) -> EmbeddingResult:
        model = model or "models/gemini-embedding-2"
        if not model.startswith("models/"):
            model = f"models/{model}"

        if not texts:
            return EmbeddingResult(embeddings=[], model=model, total_tokens=0)

        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:batchEmbedContents?key={settings.GEMINI_API_KEY}"
        
        requests = []
        for text in texts:
            requests.append({
                "model": model,
                "content": {"parts": [{"text": text}]},
                "outputDimensionality": settings.EMBEDDING_DIMENSIONS
            })

        payload = {"requests": requests}

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()

        embeddings = []
        for emb in data.get("embeddings", []):
            embeddings.append(emb.get("values", []))

        return EmbeddingResult(
            embeddings=embeddings,
            model=model,
            total_tokens=0,
        )

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.4,
        max_tokens: int | None = None,
    ) -> AsyncIterator[LLMStreamEvent]:
        model = model or "gemini-2.5-flash"
        if not model.startswith("models/"):
            model = f"models/{model}"

        max_tokens = max_tokens or settings.LLM_MAX_OUTPUT_TOKENS

        # Map to Gemini API format
        system_instruction = None
        contents = []
        for msg in messages:
            if msg["role"] == "system":
                system_instruction = {"parts": [{"text": msg["content"]}]}
            else:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}]
                })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        url = f"https://generativelanguage.googleapis.com/v1beta/{model}:streamGenerateContent?alt=sse&key={settings.GEMINI_API_KEY}"

        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, json=payload, timeout=60.0) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[len("data: "):].strip()
                        try:
                            chunk_data = json.loads(data_str)
                            candidates = chunk_data.get("candidates", [])
                            if candidates:
                                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                                if text:
                                    yield LLMStreamEvent(type="delta", text=text)
                        except Exception:
                            continue

        yield LLMStreamEvent(type="done", usage=TokenUsage())
