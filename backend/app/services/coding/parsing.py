"""Turn raw model output into validated :class:`CodingQuestion` objects.

Models truncate, fence and misname things. Rather than failing the whole
generation on one bad element, this recovers what it can: it repairs a cut-off
array, salvages individual objects, and normalises the many spellings the model
uses for the same field.
"""

from __future__ import annotations

import json
import re
from typing import Any

import structlog

from app.schemas.coding_schema import CodingExample, CodingQuestion, CodingTestCase
from app.services.execution.runtimes import normalise_language, supports_function_mode

logger = structlog.get_logger()

_VALID_TYPES = {"solve", "debug", "trace", "fill"}
_VALID_DIFFICULTY = {"easy", "medium", "hard"}
_VALID_COMPARISON = {"trim", "exact", "ignore_case", "unordered", "float"}

# Test cases are stored, shipped and re-serialised on every load; a case bigger
# than this is a performance stress test rather than a correctness check.
MAX_CASE_BYTES = 8_000


def _case_size(case: CodingTestCase) -> int:
    try:
        return len(
            json.dumps(
                {
                    "args": case.args,
                    "stdin": case.stdin,
                    "expected": case.expected,
                    "expected_stdout": case.expected_stdout,
                },
                default=str,
            )
        )
    except (TypeError, ValueError):
        return MAX_CASE_BYTES + 1


def strip_fences(raw: str) -> str:
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json|javascript|python)?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text).strip()
    return text


# ── Repairing "almost JSON" ───────────────────────────────────────────────────
# Models reliably slip Python back into test arguments — `[1] * 100000`,
# `True`, a trailing comma. One of those used to take down the entire batch,
# so the text is repaired first and then salvaged object by object.

_REPEAT_LIST = re.compile(r"\[\s*(-?\d+(?:\.\d+)?|\"[^\"]{0,40}\"|true|false|null)\s*\]\s*\*\s*(\d+)")
_REPEAT_LIST_REVERSED = re.compile(r"(\d+)\s*\*\s*\[\s*(-?\d+(?:\.\d+)?|\"[^\"]{0,40}\"|true|false|null)\s*\]")
_TRAILING_COMMA = re.compile(r",(\s*[}\]])")
_PY_CONSTANTS = ((r"\bTrue\b", "true"), (r"\bFalse\b", "false"), (r"\bNone\b", "null"))

# Expanding `[0] * 1_000_000` would be its own denial of service.
MAX_REPEAT = 500


def _expand_repeats(text: str) -> str:
    def repeat(value: str, count: str) -> str:
        n = min(int(count), MAX_REPEAT)
        return "[" + ", ".join([value] * n) + "]"

    text = _REPEAT_LIST.sub(lambda m: repeat(m.group(1), m.group(2)), text)
    text = _REPEAT_LIST_REVERSED.sub(lambda m: repeat(m.group(2), m.group(1)), text)
    return text


def repair_json_text(text: str) -> str:
    """Best-effort clean-up of near-JSON before a strict parse."""
    text = _expand_repeats(text)
    text = _TRAILING_COMMA.sub(r"\1", text)
    for pattern, replacement in _PY_CONSTANTS:
        text = re.sub(pattern, replacement, text)
    return text


def _iter_object_slices(text: str) -> list[str]:
    """Split a JSON array's top-level ``{...}`` elements into raw slices.

    Salvaging per object means one malformed question is dropped instead of
    the whole generation being lost.
    """
    slices: list[str] = []
    depth = 0
    start = -1
    in_string = False
    escaped = False

    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                slices.append(text[start : index + 1])
                start = -1
    return slices


def _salvage_objects(text: str) -> list[dict[str, Any]]:
    """Parse each top-level object independently, keeping the ones that work."""
    salvaged: list[dict[str, Any]] = []
    for index, slice_ in enumerate(_iter_object_slices(text)):
        for candidate in (slice_, repair_json_text(slice_)):
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                salvaged.append(parsed)
            break
        else:
            logger.warning("coding.parse.object_unsalvageable", index=index)
    return salvaged


def _truncate_to_last_complete(text: str) -> str | None:
    """Close a JSON array that the model cut off mid-flight."""
    start = text.find("[")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    last_complete = -1

    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char in "[{":
            depth += 1
        elif char in "]}":
            depth -= 1
            if depth == 1 and char == "}":
                last_complete = index
            elif depth == 0:
                return text[start : index + 1]

    if last_complete > 0:
        return text[start : last_complete + 1] + "]"
    return None


def load_array(raw: str) -> list[dict[str, Any]]:
    """Parse a JSON array of question objects out of arbitrary model output.

    Tries progressively looser strategies and stops at the first that yields
    anything: strict parse, extracted array, repaired text, truncation repair,
    and finally per-object salvage.
    """
    text = strip_fences(raw)
    if not text:
        return []

    repaired = repair_json_text(text)
    candidates = (
        text,
        _extract_array(text),
        repaired,
        _extract_array(repaired),
        _truncate_to_last_complete(repaired),
    )

    for candidate in candidates:
        if not candidate:
            continue
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            items = [item for item in data if isinstance(item, dict)]
            if items:
                return items
        if isinstance(data, dict):
            for key in ("questions", "items", "data", "result"):
                nested = data.get(key)
                if isinstance(nested, list):
                    return [item for item in nested if isinstance(item, dict)]
            return [data]

    # Last resort: keep every object that parses on its own.
    salvaged = _salvage_objects(repaired)
    if salvaged:
        logger.info("coding.parse.salvaged", count=len(salvaged))
    return salvaged


def _extract_array(text: str) -> str | None:
    match = re.search(r"\[.*\]", text, re.DOTALL)
    return match.group(0) if match else None


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _first(item: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return item[key]
    return default


def _clean_code(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z+#]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip() or None


def _parse_test_case(raw: Any, *, function_mode: bool) -> CodingTestCase | None:
    if not isinstance(raw, dict):
        return None

    args = _first(raw, "args", "arguments", "input_args", "params")
    stdin = _first(raw, "stdin", "input_stdin")
    expected = raw.get("expected", raw.get("expected_output", raw.get("output")))
    expected_stdout = _first(raw, "expected_stdout", "stdout")

    if function_mode:
        if args is None and isinstance(raw.get("input"), list):
            args = raw["input"]
        elif args is None and "input" in raw:
            args = [raw["input"]]
        if args is not None and not isinstance(args, list):
            args = [args]
        if args is None and stdin is None:
            return None
    else:
        if stdin is None and isinstance(raw.get("input"), str):
            stdin = raw["input"]
        if expected_stdout is None and isinstance(expected, str):
            expected_stdout, expected = expected, None
        if stdin is None and expected_stdout is None:
            return None

    kwargs = raw.get("kwargs")
    if not isinstance(kwargs, dict):
        kwargs = None

    return CodingTestCase(
        name=raw.get("name") if isinstance(raw.get("name"), str) else None,
        args=args if isinstance(args, list) else None,
        kwargs=kwargs,
        stdin=str(stdin) if stdin is not None else None,
        expected=expected,
        expected_stdout=str(expected_stdout) if expected_stdout is not None else None,
        hidden=bool(raw.get("hidden", False)),
        explanation=raw.get("explanation") if isinstance(raw.get("explanation"), str) else None,
    )


def parse_question(
    item: dict[str, Any],
    *,
    index: int,
    language: str,
) -> CodingQuestion | None:
    """Build one validated question, or None if it is unusable."""
    problem = _first(item, "problem", "problem_statement", "question", "description")
    solution = _clean_code(_first(item, "solution", "reference_solution", "answer"))
    if not problem or not solution:
        return None

    question_type = str(_first(item, "type", "question_type", default="solve")).lower()
    if question_type not in _VALID_TYPES:
        question_type = "solve"

    difficulty = str(_first(item, "difficulty", default="medium")).lower()
    if difficulty not in _VALID_DIFFICULTY:
        difficulty = "medium"

    function_mode = supports_function_mode(language)
    io_mode = str(_first(item, "io_mode", default="")).lower()
    if io_mode not in {"function", "stdio"}:
        io_mode = "function" if function_mode else "stdio"
    elif io_mode == "function" and not function_mode:
        io_mode = "stdio"

    comparison = str(_first(item, "comparison", default="trim")).lower()
    if comparison not in _VALID_COMPARISON:
        comparison = "trim"

    examples: list[CodingExample] = []
    for raw_example in _as_list(item.get("examples"))[:3]:
        if not isinstance(raw_example, dict):
            continue
        try:
            examples.append(
                CodingExample(
                    input=str(_first(raw_example, "input", "in", default="")),
                    output=str(_first(raw_example, "output", "out", default="")),
                    explanation=(
                        str(raw_example["explanation"])
                        if raw_example.get("explanation")
                        else None
                    ),
                )
            )
        except Exception:  # noqa: BLE001 — one malformed example must not sink the question
            continue

    test_cases: list[CodingTestCase] = []
    if question_type != "trace":
        for raw_case in _as_list(_first(item, "tests", "test_cases", default=[]))[:12]:
            parsed = _parse_test_case(raw_case, function_mode=io_mode == "function")
            if parsed is None:
                continue
            if _case_size(parsed) > MAX_CASE_BYTES:
                # A huge literal input is a stress test, not a correctness test;
                # it bloats every payload and slows grading for no benefit.
                logger.info("coding.parse.case_too_large", title=item.get("title"))
                continue
            test_cases.append(parsed)

    starter = _clean_code(
        _first(item, "starter_code", "code_snippet", "starter", "template")
    )
    if question_type == "trace" and not starter:
        starter = solution

    entry_point = _first(item, "entry_point", "function_name", "entrypoint")
    if isinstance(entry_point, str):
        entry_point = entry_point.strip().split("(")[0].strip() or None
    else:
        entry_point = None
    if io_mode == "stdio":
        entry_point = None

    hints = [str(hint) for hint in _as_list(item.get("hints"))[:3] if hint]
    constraints = [str(item_) for item_ in _as_list(item.get("constraints"))[:5] if item_]

    try:
        return CodingQuestion(
            number=int(item.get("number") or index),
            type=question_type,  # type: ignore[arg-type]
            title=str(_first(item, "title", default=f"Problem {index}"))[:120],
            language=normalise_language(item.get("language") or language),
            difficulty=difficulty,  # type: ignore[arg-type]
            topic_hint=(
                str(item["topic_hint"]) if item.get("topic_hint") else None
            ),
            problem=str(problem).strip(),
            code_snippet=starter,
            examples=examples,
            constraints=constraints,
            hints=hints,
            solution=solution,
            solution_explanation=str(
                _first(item, "solution_explanation", "explanation", default="")
            ).strip(),
            io_mode=io_mode,  # type: ignore[arg-type]
            entry_point=entry_point,
            test_cases=test_cases,
            comparison=comparison,  # type: ignore[arg-type]
            complexity=(str(item["complexity"]) if item.get("complexity") else None),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("coding.parse.skip_question", index=index, error=str(exc))
        return None


def parse_questions(
    raw: str, *, language: str, start_number: int, limit: int
) -> list[CodingQuestion]:
    """Parse up to ``limit`` questions, renumbering them from ``start_number``."""
    questions: list[CodingQuestion] = []
    for offset, item in enumerate(load_array(raw)[:limit]):
        parsed = parse_question(item, index=start_number + offset, language=language)
        if parsed is None:
            continue
        parsed.number = start_number + len(questions)
        questions.append(parsed)
    return questions
