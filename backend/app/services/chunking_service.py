"""ChunkingService — recursive character splitting with structure protection.

Rules (from project spec):
  * target 450–500 tokens per chunk, 75-token overlap
  * never split code blocks, tables, or math formulas
  * preserve page number + heading on every chunk

Token counting uses tiktoken when available and falls back to a ~4-chars/token
heuristic otherwise (tiktoken is not a hard dependency).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings
from app.services.extraction_service import ExtractedBlock

# ── Token estimation ──────────────────────────────────────────────────────────
try:  # optional accelerator
    import tiktoken

    _ENC = tiktoken.get_encoding("cl100k_base")

    def estimate_tokens(text: str) -> int:
        return len(_ENC.encode(text)) if text else 0
except Exception:  # pragma: no cover - fallback path
    _ENC = None

    def estimate_tokens(text: str) -> int:
        return max(1, len(text) // 4) if text else 0


@dataclass(slots=True)
class ChunkData:
    content: str
    token_count: int
    chunk_index: int
    page_number: int | None
    heading: str | None


# ── Protected-region + sentence atom extraction ──────────────────────────────
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


@dataclass(slots=True)
class _Atom:
    text: str
    protected: bool


def _atoms(text: str) -> list[_Atom]:
    """Break a block into atoms; protected atoms are never split further."""
    lines = text.split("\n")
    atoms: list[_Atom] = []
    normal: list[str] = []
    i = 0

    def flush_normal() -> None:
        if not normal:
            return
        joined = "\n".join(normal).strip()
        normal.clear()
        if not joined:
            return
        # Sentence-level atoms for finer packing.
        for sent in _SENTENCE_SPLIT.split(joined):
            sent = sent.strip()
            if sent:
                atoms.append(_Atom(text=sent, protected=False))

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Fenced code block ```...```
        if stripped.startswith("```"):
            flush_normal()
            block = [line]
            i += 1
            while i < len(lines):
                block.append(lines[i])
                if lines[i].strip().startswith("```"):
                    i += 1
                    break
                i += 1
            atoms.append(_Atom(text="\n".join(block), protected=True))
            continue

        # Block math $$...$$
        if stripped == "$$":
            flush_normal()
            block = [line]
            i += 1
            while i < len(lines):
                block.append(lines[i])
                if lines[i].strip() == "$$":
                    i += 1
                    break
                i += 1
            atoms.append(_Atom(text="\n".join(block), protected=True))
            continue

        # Table run: consecutive lines containing a pipe.
        if "|" in stripped and stripped.count("|") >= 1 and len(stripped) > 1:
            flush_normal()
            block = [line]
            i += 1
            while i < len(lines) and "|" in lines[i]:
                block.append(lines[i])
                i += 1
            atoms.append(_Atom(text="\n".join(block), protected=True))
            continue

        normal.append(line)
        i += 1

    flush_normal()
    return atoms


def _hard_split(text: str, max_tokens: int) -> list[str]:
    """Last-resort split of an oversized non-protected atom, on char budget."""
    approx_chars = max_tokens * 4
    return [text[j : j + approx_chars] for j in range(0, len(text), approx_chars)] or [text]


# ── Packing ────────────────────────────────────────────────────────────────────

def _pack_block(
    block: ExtractedBlock,
    start_index: int,
    target: int,
    overlap: int,
) -> list[ChunkData]:
    atoms = _atoms(block.text)
    chunks: list[ChunkData] = []
    current: list[str] = []
    current_tokens = 0
    idx = start_index

    def emit(keep_overlap: bool = True) -> None:
        nonlocal current, current_tokens, idx
        if current:
            content = "\n".join(current).strip()
            if content:
                chunks.append(
                    ChunkData(
                        content=content,
                        token_count=estimate_tokens(content),
                        chunk_index=idx,
                        page_number=block.page_number,
                        heading=block.heading,
                    )
                )
                idx += 1
        if not keep_overlap:
            current, current_tokens = [], 0
            return
        # Build overlap tail from trailing atoms (≈ `overlap` tokens).
        tail: list[str] = []
        tail_tokens = 0
        for piece in reversed(current):
            t = estimate_tokens(piece)
            if tail_tokens + t > overlap:
                break
            tail.insert(0, piece)
            tail_tokens += t
        current = tail
        current_tokens = tail_tokens

    for atom in atoms:
        atom_tokens = estimate_tokens(atom.text)

        # Oversized protected atom → its own chunk, unsplit.
        if atom.protected and atom_tokens > target:
            emit(keep_overlap=False)  # close whatever is open, no overlap carry
            chunks.append(
                ChunkData(
                    content=atom.text.strip(),
                    token_count=atom_tokens,
                    chunk_index=idx,
                    page_number=block.page_number,
                    heading=block.heading,
                )
            )
            idx += 1
            continue

        # Oversized normal atom → hard split.
        pieces = _hard_split(atom.text, target) if (not atom.protected and atom_tokens > target) else [atom.text]

        for piece in pieces:
            ptok = estimate_tokens(piece)
            if current and current_tokens + ptok > target:
                emit()
            current.append(piece)
            current_tokens += ptok

    emit()
    return chunks


def chunk_blocks(blocks: list[ExtractedBlock]) -> list[ChunkData]:
    """Chunk a document's blocks. Chunk indices are contiguous across the doc.

    Chunking is done per-block so a chunk never spans two pages/headings —
    that keeps ``page_number``/``heading`` accurate for citations.
    """
    target = settings.CHUNK_TARGET_TOKENS
    overlap = settings.CHUNK_OVERLAP_TOKENS
    all_chunks: list[ChunkData] = []
    for block in blocks:
        block_chunks = _pack_block(block, len(all_chunks), target, overlap)
        all_chunks.extend(block_chunks)
    return all_chunks
