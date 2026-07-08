"""PromptBuilder — assemble LLM messages from retrieved context + settings.

Keeps all context-assembly + citation logic in one place so every AI feature
builds prompts the same way. Returns provider-agnostic
:class:`ChatMessage` lists.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from app.repositories.chunk_repository import ScoredChunk
from app.services.ai.base import ChatMessage
from app.services.prompt_registry import BASE_SYSTEM, PromptTemplate


@dataclass(slots=True)
class GenerationOptions:
    length: str = "medium"            # short | medium | long | comprehensive
    difficulty: str = "intermediate"  # beginner | intermediate | advanced
    audience: str = "university student"
    language: str = "English"
    output_format: str = "markdown"
    tone: str = "neutral"
    exam_focus: bool = False
    include_citations: bool = True


@dataclass(slots=True)
class Citation:
    index: int
    chunk_id: UUID
    resource_id: UUID
    resource_title: str
    page_number: int | None
    heading: str | None
    snippet: str
    similarity: float


@dataclass(slots=True)
class PromptBundle:
    messages: list[ChatMessage]
    citations: list[Citation]
    context_chars: int = field(default=0)


_LENGTH_GUIDANCE = {
    "short": "Keep it brief — roughly 300–500 words.",
    "medium": "Aim for a moderate length — roughly 600–1000 words.",
    "long": "Be thorough — roughly 1200–2000 words.",
    "comprehensive": "Be exhaustive — cover everything in the context, length as needed.",
}


def build_context(
    scored: list[ScoredChunk],
    resource_titles: dict[UUID, str],
) -> tuple[str, list[Citation]]:
    """Render retrieved chunks into a numbered context string + citation list."""
    citations: list[Citation] = []
    lines: list[str] = []
    for i, sc in enumerate(scored, start=1):
        chunk = sc.chunk
        title = resource_titles.get(chunk.resource_id, "Untitled")
        locator = []
        if chunk.page_number is not None:
            locator.append(f"p.{chunk.page_number}")
        if chunk.heading:
            locator.append(chunk.heading)
        loc = f" — {', '.join(locator)}" if locator else ""
        lines.append(f"[{i}] (Source: {title}{loc})\n{chunk.content}")
        citations.append(
            Citation(
                index=i,
                chunk_id=chunk.id,
                resource_id=chunk.resource_id,
                resource_title=title,
                page_number=chunk.page_number,
                heading=chunk.heading,
                snippet=(chunk.content[:200] + "…") if len(chunk.content) > 200 else chunk.content,
                similarity=sc.similarity,
            )
        )
    return "\n\n".join(lines), citations


def build_system_prompt(template: PromptTemplate, options: GenerationOptions) -> str:
    parts = [BASE_SYSTEM, "", f"TASK: {template.instruction}", ""]
    parts.append("STYLE:")
    parts.append(f"- Audience: {options.audience}")
    parts.append(f"- Difficulty: {options.difficulty}")
    parts.append(f"- Tone: {options.tone}")
    parts.append(f"- Language: write the notes in {options.language}.")
    parts.append(f"- Length: {_LENGTH_GUIDANCE.get(options.length, _LENGTH_GUIDANCE['medium'])}")
    if options.exam_focus:
        parts.append("- Emphasize exam-relevant, high-yield content.")
    if options.include_citations:
        parts.append(
            "- Cite sources inline with [n] markers that correspond to the numbered "
            "SOURCE CONTEXT blocks. Place a citation after each fact drawn from a source."
        )
    else:
        parts.append("- Do not include citation markers.")
    return "\n".join(parts)


def build_messages(
    template: PromptTemplate,
    options: GenerationOptions,
    *,
    topic: str | None,
    context_text: str,
) -> list[ChatMessage]:
    system = build_system_prompt(template, options)
    topic_line = f"Focus topic: {topic}\n\n" if topic else ""
    user = (
        f"{topic_line}Generate the notes described by the task using ONLY the "
        f"following numbered source context.\n\n"
        f"=== SOURCE CONTEXT ===\n{context_text}\n=== END SOURCE CONTEXT ==="
    )
    return [
        ChatMessage(role="system", content=system),
        ChatMessage(role="user", content=user),
    ]


def build_prompt_bundle(
    template: PromptTemplate,
    options: GenerationOptions,
    *,
    topic: str | None,
    scored: list[ScoredChunk],
    resource_titles: dict[UUID, str],
) -> PromptBundle:
    context_text, citations = build_context(scored, resource_titles)
    messages = build_messages(template, options, topic=topic, context_text=context_text)
    return PromptBundle(messages=messages, citations=citations, context_chars=len(context_text))
