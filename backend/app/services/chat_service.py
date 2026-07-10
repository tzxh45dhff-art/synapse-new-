"""ChatService — orchestrates the global Ask AI assistant on the shared RAG pipeline.

Responsibilities:
  * resolve which vaults a user may search — every vault they belong to for a
    global session, or a single vault for a session pinned to one
  * assemble prompts (shared context builder + chat-specific system prompt
    and conversation history) and stream the LLM answer (SSE)
  * persist sessions, messages, citations, feedback and cost logs

Retrieval NEVER feeds whole documents to the model — it always goes through
VectorSearchService, and every underlying query stays hard-scoped to one
``vault_id``, even when fanned out across many vaults for a global session.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import AsyncIterator
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import AsyncSessionLocal
from app.models.chat import ChatFeedback as ChatFeedbackModel
from app.models.chat import ChatMessage as ChatMessageModel
from app.models.chat import ChatSession as ChatSessionModel
from app.models.chat import Citation as CitationModel
from app.models.resource import Resource, ResourceChunk
from app.models.squad import SquadMember
from app.models.vault import Vault
from app.repositories.chat_repository import ChatRepository
from app.repositories.chunk_repository import ScoredChunk
from app.schemas.auth import CurrentUser
from app.services import prompt_builder, vector_search_service
from app.services.ai import get_provider
from app.services.ai.base import ChatMessage as LLMMessage
from app.services.ai.base import TokenUsage
from app.services.ai.pricing import estimate_cost
from app.services.ai.usage_logger import log_generation

logger = structlog.get_logger()

CHAT_SEARCH_TOP_K = 20
CHAT_RERANK_K = 6
HISTORY_LIMIT = 20

_CHAT_SYSTEM_PROMPT = (
    "You are Bunker's study assistant. You answer questions using the "
    "student's own uploaded course material, retrieved from across their vaults.\n"
    "Absolute rules:\n"
    "- Use the provided source context to answer. Never invent facts. If the "
    "context doesn't contain the answer, say so plainly instead of guessing. If it is "
    "a general study-related question (academic subjects, concepts, homework help, "
    "exam prep, etc.) whether or not it's in the context, explain it normally and just "
    "note it wasn't found in the documents.\n"
    "- Scope: only answer study/academic/learning-related questions (course subjects, "
    "concepts, problems, exam/assignment help, study/learning advice). If the student "
    "asks something unrelated to studying (small talk, general life advice, current "
    "events, entertainment, coding a personal app, etc.), politely decline and steer "
    "them back to their study material — do not answer it.\n"
    "- Cite sources inline with [n] markers that correspond to the numbered SOURCE "
    "CONTEXT blocks. Place a citation after each fact drawn from a source.\n"
    "- Write in GitHub-flavored Markdown, using LaTeX ($inline$, $$block$$) for "
    "formulas when relevant.\n"
    "- Be concise and conversational — this is a chat, not a document."
)


@dataclass(slots=True)
class ChatCitation:
    """A citation enriched with vault/squad metadata for reference-card navigation."""

    index: int
    chunk_id: UUID
    resource_id: UUID
    resource_title: str
    vault_id: UUID
    vault_title: str
    squad_id: UUID
    page_number: int | None
    heading: str | None
    snippet: str
    similarity: float


# ─────────────────────────────────────────────────────────────────────────────
# Authorization helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _assert_vault_access(db: AsyncSession, vault_id: UUID, user_id: UUID) -> Vault:
    result = await db.execute(
        select(Vault).where(Vault.id == vault_id, Vault.deleted_at.is_(None))
    )
    vault = result.scalar_one_or_none()
    if not vault:
        raise NotFoundError("Vault")
    mem = await db.execute(
        select(SquadMember).where(
            SquadMember.squad_id == vault.squad_id,
            SquadMember.user_id == user_id,
            SquadMember.removed_at.is_(None),
        )
    )
    if not mem.scalar_one_or_none():
        raise ForbiddenError("You are not a member of this squad.")
    return vault


async def _assert_session_owner(
    db: AsyncSession, session_id: UUID, user_id: UUID
) -> ChatSessionModel:
    session = await ChatRepository(db).get_session(session_id)
    if not session:
        raise NotFoundError("Chat session")
    if session.user_id != user_id:
        raise ForbiddenError("This chat session does not belong to you.")
    return session


async def _resolve_accessible_vaults(
    db: AsyncSession, user_id: UUID
) -> list[tuple[UUID, UUID, str]]:
    """Every (vault_id, squad_id, title) the user can search — the security boundary
    for global (unscoped) chat sessions."""
    result = await db.execute(
        select(Vault.id, Vault.squad_id, Vault.title)
        .join(SquadMember, SquadMember.squad_id == Vault.squad_id)
        .where(
            SquadMember.user_id == user_id,
            SquadMember.removed_at.is_(None),
            Vault.deleted_at.is_(None),
        )
    )
    return [(row[0], row[1], row[2]) for row in result.all()]


# ─────────────────────────────────────────────────────────────────────────────
# Session / history CRUD
# ─────────────────────────────────────────────────────────────────────────────

async def create_session(
    db: AsyncSession, user: CurrentUser, vault_id: UUID | None = None
) -> ChatSessionModel:
    if vault_id is not None:
        await _assert_vault_access(db, vault_id, user.id)
    session = ChatSessionModel(user_id=user.id, vault_id=vault_id)
    await ChatRepository(db).create_session(session)
    await db.commit()
    await db.refresh(session)
    return session


async def list_sessions(db: AsyncSession, user: CurrentUser) -> list[ChatSessionModel]:
    return await ChatRepository(db).list_sessions_for_user(user.id)


async def _resolve_chunk_meta(
    db: AsyncSession, chunk_ids: set[UUID]
) -> dict[UUID, tuple[UUID, UUID, int | None, str | None]]:
    """chunk_id -> (resource_id, vault_id, page_number, heading)."""
    if not chunk_ids:
        return {}
    result = await db.execute(
        select(
            ResourceChunk.id,
            ResourceChunk.resource_id,
            ResourceChunk.vault_id,
            ResourceChunk.page_number,
            ResourceChunk.heading,
        ).where(ResourceChunk.id.in_(chunk_ids))
    )
    return {row[0]: (row[1], row[2], row[3], row[4]) for row in result.all()}


async def get_messages(
    db: AsyncSession, user: CurrentUser, session_id: UUID
) -> list[dict]:
    """History, reads. Citation rows only persist chunk_id + score + snippet, so
    the vault/resource attribution needed for reference cards is re-joined here
    rather than stored redundantly on every message."""
    session = await _assert_session_owner(db, session_id, user.id)
    messages = await ChatRepository(db).list_messages(session.id)

    chunk_ids = {c.chunk_id for m in messages for c in m.citations}
    chunk_meta = await _resolve_chunk_meta(db, chunk_ids)
    titles = await _resolve_titles(db, {meta[0] for meta in chunk_meta.values()})

    vault_ids = {meta[1] for meta in chunk_meta.values()}
    vault_meta: dict[UUID, tuple[UUID, str]] = {}
    if vault_ids:
        vault_rows = await db.execute(
            select(Vault.id, Vault.squad_id, Vault.title).where(Vault.id.in_(vault_ids))
        )
        vault_meta = {row[0]: (row[1], row[2]) for row in vault_rows.all()}

    serialized: list[dict] = []
    for m in messages:
        citation_dicts = []
        for idx, c in enumerate(m.citations, start=1):
            meta = chunk_meta.get(c.chunk_id)
            if not meta:
                continue
            resource_id, vault_id, page_number, heading = meta
            squad_id, vault_title = vault_meta.get(vault_id, (vault_id, "Unknown vault"))
            citation_dicts.append({
                "index": idx,
                "chunk_id": c.chunk_id,
                "resource_id": resource_id,
                "resource_title": titles.get(resource_id, "Untitled"),
                "vault_id": vault_id,
                "vault_title": vault_title,
                "squad_id": squad_id,
                "page_number": page_number,
                "heading": heading,
                "snippet": c.snippet or "",
                "similarity": float(c.relevance_score) if c.relevance_score is not None else 0.0,
            })
        serialized.append({
            "id": m.id,
            "session_id": m.session_id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at,
            "citations": citation_dicts,
        })
    return serialized


# ─────────────────────────────────────────────────────────────────────────────
# Retrieval
# ─────────────────────────────────────────────────────────────────────────────

async def _resolve_titles(db: AsyncSession, resource_ids: set[UUID]) -> dict[UUID, str]:
    if not resource_ids:
        return {}
    result = await db.execute(
        select(Resource.id, Resource.title).where(Resource.id.in_(resource_ids))
    )
    return {row[0]: row[1] for row in result.all()}


async def _retrieve(
    db: AsyncSession, session: ChatSessionModel, user_id: UUID, query: str
) -> tuple[list[ScoredChunk], dict[UUID, tuple[UUID, str]]]:
    """Returns scored chunks plus a vault_id -> (squad_id, vault_title) map."""
    if session.vault_id is not None:
        vault = await _assert_vault_access(db, session.vault_id, user_id)
        scored = await vector_search_service.search(
            db, vault_id=vault.id, query=query, user_id=user_id,
            top_k=CHAT_SEARCH_TOP_K, rerank_k=CHAT_RERANK_K,
        )
        return scored, {vault.id: (vault.squad_id, vault.title)}

    accessible = await _resolve_accessible_vaults(db, user_id)
    if not accessible:
        return [], {}
    vault_ids = [v[0] for v in accessible]
    vault_meta = {v[0]: (v[1], v[2]) for v in accessible}
    scored = await vector_search_service.search_multi_vault(
        db, vault_ids=vault_ids, query=query, user_id=user_id,
        top_k=CHAT_SEARCH_TOP_K, rerank_k=CHAT_RERANK_K,
    )
    return scored, vault_meta


def _enrich_citations(
    base: list[prompt_builder.Citation],
    scored: list[ScoredChunk],
    vault_meta: dict[UUID, tuple[UUID, str]],
) -> list[ChatCitation]:
    enriched: list[ChatCitation] = []
    for citation, sc in zip(base, scored):
        vault_id = sc.chunk.vault_id
        squad_id, vault_title = vault_meta.get(vault_id, (vault_id, "Unknown vault"))
        enriched.append(
            ChatCitation(
                index=citation.index,
                chunk_id=citation.chunk_id,
                resource_id=citation.resource_id,
                resource_title=citation.resource_title,
                vault_id=vault_id,
                vault_title=vault_title,
                squad_id=squad_id,
                page_number=citation.page_number,
                heading=citation.heading,
                snippet=citation.snippet,
                similarity=citation.similarity,
            )
        )
    return enriched


# ─────────────────────────────────────────────────────────────────────────────
# Streaming generation (SSE)
# ─────────────────────────────────────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _citation_dict(c: ChatCitation) -> dict:
    return {
        "index": c.index,
        "chunk_id": str(c.chunk_id),
        "resource_id": str(c.resource_id),
        "resource_title": c.resource_title,
        "vault_id": str(c.vault_id),
        "vault_title": c.vault_title,
        "squad_id": str(c.squad_id),
        "page_number": c.page_number,
        "heading": c.heading,
        "snippet": c.snippet,
        "similarity": c.similarity,
    }


async def stream_message(
    user: CurrentUser, session_id: UUID, content: str
) -> AsyncIterator[str]:
    """Answer one chat turn, streaming SSE events.

    Events: ``meta`` (citations) → ``delta``* (text) → ``done`` (message_id +
    usage), or ``error``. Owns its own DB session so the stream is not bound to
    the request-scoped session lifecycle.
    """
    async with AsyncSessionLocal() as db:
        try:
            session = await _assert_session_owner(db, session_id, user.id)
            repo = ChatRepository(db)
            history_rows = await repo.list_messages(session.id, limit=HISTORY_LIMIT)

            scored, vault_meta = await _retrieve(db, session, user.id, content)
            if not scored:
                yield _sse("error", {
                    "message": "No AI-ready content found across your vaults yet. "
                               "Upload some resources and wait for them to finish "
                               "processing, then ask again.",
                })
                return

            titles = await _resolve_titles(db, {sc.chunk.resource_id for sc in scored})
            context_text, base_citations = prompt_builder.build_context(scored, titles)
            citations = _enrich_citations(base_citations, scored, vault_meta)

            messages: list[LLMMessage] = [
                LLMMessage(role="system", content=_CHAT_SYSTEM_PROMPT)
            ]
            for h in history_rows:
                messages.append(LLMMessage(role=h.role, content=h.content))
            user_turn = (
                f"=== SOURCE CONTEXT ===\n{context_text}\n=== END SOURCE CONTEXT ===\n\n"
                f"{content}"
            )
            messages.append(LLMMessage(role="user", content=user_turn))

            yield _sse("meta", {"citations": [_citation_dict(c) for c in citations]})

            provider = get_provider()
            usage = TokenUsage()
            parts: list[str] = []
            started = time.perf_counter()

            async for evt in provider.stream_chat(messages, temperature=0.4):
                if evt.type == "delta":
                    parts.append(evt.text)
                    yield _sse("delta", {"text": evt.text})
                elif evt.type == "done":
                    usage = evt.usage

            answer = "".join(parts).strip()
            latency_ms = int((time.perf_counter() - started) * 1000)
            if not answer:
                yield _sse("error", {"message": "The model returned no content."})
                return

            gen_log = await log_generation(
                db,
                user_id=user.id,
                vault_id=session.vault_id,
                generation_type="chat_completion",
                model=settings.LLM_CHAT_MODEL,
                usage=usage,
                latency_ms=latency_ms,
                metadata={"session_id": str(session.id), "citations": len(citations)},
            )

            user_msg = ChatMessageModel(session_id=session.id, role="user", content=content)
            await repo.create_message(user_msg)
            assistant_msg = ChatMessageModel(
                session_id=session.id,
                role="assistant",
                content=answer,
                token_count=usage.total_tokens,
                context_chunks={"chunk_ids": [str(c.chunk_id) for c in citations]},
                generation_id=gen_log.id,
            )
            await repo.create_message(assistant_msg)
            await repo.bulk_create_citations([
                CitationModel(
                    message_id=assistant_msg.id,
                    chunk_id=c.chunk_id,
                    relevance_score=c.similarity,
                    snippet=c.snippet,
                )
                for c in citations
            ])
            await repo.touch_session(session, by=2)
            await db.commit()

            yield _sse("done", {
                "message_id": str(assistant_msg.id),
                "session_id": str(session.id),
                "generation": {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                    "cost_usd": estimate_cost(
                        settings.LLM_CHAT_MODEL, usage.prompt_tokens, usage.completion_tokens
                    ),
                    "latency_ms": latency_ms,
                    "model": settings.LLM_CHAT_MODEL,
                    "provider": provider.name,
                },
            })
        except (ForbiddenError, NotFoundError) as e:
            await db.rollback()
            yield _sse("error", {"message": e.detail})
        except Exception as e:  # pragma: no cover - safety net
            await db.rollback()
            logger.error("chat.stream_failed", error=str(e))
            yield _sse("error", {"message": "Chat failed. Please retry."})


# ─────────────────────────────────────────────────────────────────────────────
# Feedback
# ─────────────────────────────────────────────────────────────────────────────

async def submit_feedback(
    db: AsyncSession,
    user: CurrentUser,
    message_id: UUID,
    rating: int,
    feedback_text: str | None = None,
    feedback_tags: list[str] | None = None,
) -> ChatFeedbackModel:
    result = await db.execute(
        select(ChatMessageModel, ChatSessionModel)
        .join(ChatSessionModel, ChatSessionModel.id == ChatMessageModel.session_id)
        .where(ChatMessageModel.id == message_id)
    )
    row = result.first()
    if not row:
        raise NotFoundError("Message")
    _, session = row
    if session.user_id != user.id:
        raise ForbiddenError("This message does not belong to you.")

    feedback = ChatFeedbackModel(
        message_id=message_id,
        user_id=user.id,
        rating=rating,
        feedback_text=feedback_text,
        feedback_tags=feedback_tags or None,
    )
    await ChatRepository(db).create_feedback(feedback)
    await db.commit()
    await db.refresh(feedback)
    return feedback
