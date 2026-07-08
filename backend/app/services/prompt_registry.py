"""Versioned prompt template registry for note generation.

Prompts are DATA, never hardcoded inside services. Each mode maps to a
:class:`PromptTemplate` with a ``version`` so prompt changes are auditable and
A/B-able. Adding a mode = adding a registry entry.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PromptTemplate:
    key: str
    version: str
    label: str
    description: str
    instruction: str  # mode-specific body appended to the shared system prompt


# ── Shared base system prompt ───────────────────────────────────────────────
BASE_SYSTEM = (
    "You are Bunker's expert study-notes generator. You transform retrieved "
    "source material into clear, accurate, well-structured study notes.\n"
    "Absolute rules:\n"
    "- Use ONLY the provided source context. Never invent facts. If the context "
    "is insufficient, say so briefly instead of fabricating.\n"
    "- Output GitHub-flavored Markdown: headings, lists, tables, fenced code, and "
    "LaTeX math ($inline$ and $$block$$) where appropriate.\n"
    "- Preserve technical accuracy for formulas, code, and definitions."
)


# ── Mode templates ───────────────────────────────────────────────────────────
_TEMPLATES: dict[str, PromptTemplate] = {
    "full_notes": PromptTemplate(
        key="full_notes", version="1.0", label="Full Notes",
        description="Comprehensive, well-structured notes covering the material.",
        instruction=(
            "Produce comprehensive study notes. Organize with a clear heading "
            "hierarchy, cover every major topic in the context, and use lists and "
            "tables to structure information."
        ),
    ),
    "summary": PromptTemplate(
        key="summary", version="1.0", label="Summary",
        description="A concise high-level summary of the material.",
        instruction=(
            "Write a concise summary capturing the core ideas and conclusions. "
            "Favor brevity; omit minor detail. End with a short 'Key Takeaways' list."
        ),
    ),
    "exam_notes": PromptTemplate(
        key="exam_notes", version="1.0", label="Exam Notes",
        description="High-yield notes focused on what is likely to be tested.",
        instruction=(
            "Produce high-yield exam notes: prioritize testable facts, common "
            "pitfalls, and must-know formulas/definitions. Use compact bullets and "
            "callouts (> **Note:**) for exam tips."
        ),
    ),
    "revision_notes": PromptTemplate(
        key="revision_notes", version="1.0", label="Revision Notes",
        description="Fast last-minute revision notes.",
        instruction=(
            "Produce fast revision notes: short, scannable bullets grouped by topic, "
            "each stating one memorable point. Bold key terms."
        ),
    ),
    "detailed_notes": PromptTemplate(
        key="detailed_notes", version="1.0", label="Detailed Notes",
        description="In-depth notes with explanations and examples.",
        instruction=(
            "Produce detailed notes with thorough explanations, worked examples, and "
            "reasoning. Expand on mechanisms and edge cases present in the context."
        ),
    ),
    "bullet_notes": PromptTemplate(
        key="bullet_notes", version="1.0", label="Bullet Notes",
        description="Pure bullet-point notes.",
        instruction=(
            "Produce notes as nested bullet points only. No paragraphs. Group bullets "
            "under short bold topic labels."
        ),
    ),
    "concept_explanation": PromptTemplate(
        key="concept_explanation", version="1.0", label="Concept Explanation",
        description="Explain the key concepts in depth, teaching-style.",
        instruction=(
            "Explain the key concepts as a patient teacher would: define the concept, "
            "explain why it matters, give an intuition/analogy, then a precise "
            "explanation grounded in the context."
        ),
    ),
    "formula_sheet": PromptTemplate(
        key="formula_sheet", version="1.0", label="Formula Sheet",
        description="A clean sheet of all formulas with symbol definitions.",
        instruction=(
            "Extract every formula from the context into a formula sheet. Render each "
            "in LaTeX ($$...$$), and for each define its symbols and when it applies. "
            "Group by topic. Do not include prose beyond symbol definitions."
        ),
    ),
    "cheat_sheet": PromptTemplate(
        key="cheat_sheet", version="1.0", label="Cheat Sheet",
        description="A dense one-page cheat sheet.",
        instruction=(
            "Produce a dense, one-page-style cheat sheet: tight tables, key formulas, "
            "definitions, and rules. Maximize information density; minimize prose."
        ),
    ),
    "definitions_only": PromptTemplate(
        key="definitions_only", version="1.0", label="Definitions Only",
        description="A glossary of key terms and definitions.",
        instruction=(
            "Extract key terms and produce a glossary. Format each as '**Term** — "
            "definition'. Sort alphabetically. Include only terms defined in the context."
        ),
    ),
    "qa_notes": PromptTemplate(
        key="qa_notes", version="1.0", label="Question & Answer Notes",
        description="Question-and-answer study notes.",
        instruction=(
            "Produce question-and-answer notes. For each key point, pose a likely exam "
            "question, then answer it concisely. Format: '**Q:** ...' then '**A:** ...'."
        ),
    ),
}


def get_template(key: str) -> PromptTemplate:
    template = _TEMPLATES.get(key)
    if not template:
        raise KeyError(f"Unknown note generation mode: '{key}'")
    return template


def list_templates() -> list[PromptTemplate]:
    return list(_TEMPLATES.values())


def is_valid_mode(key: str) -> bool:
    return key in _TEMPLATES
