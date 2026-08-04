"""Grading a submission.

Order of preference:

  1. **Execute it.** Verified test cases + an installed runtime means the verdict
     comes from a real process, so a hardcoded or printed answer fails the
     hidden cases the way it should.
  2. **Simulate it.** Only when the server has no toolchain for the language, or
     the question predates the executable contract. The response is labelled
     ``engine="simulated"`` so the UI can say so out loud.

The language model is never the judge when we can run the code — it only writes
the prose review on top of a verdict that is already decided.
"""

from __future__ import annotations

import ast
import asyncio
import json
import re
from typing import Any

import structlog

from app.schemas.coding_schema import (
    CodingGradeResponse,
    CodingQuestion,
    CodingTestCase,
    CodingTestResult,
)
from app.services.ai.factory import get_provider
from app.services.coding.prompts import REVIEW_SYSTEM_PROMPT, SIMULATION_SYSTEM_PROMPT
from app.services.execution.engine import (
    ExecutionOutcome,
    RuntimeUnavailable,
    TestOutcome,
    run_program,
    run_test_suite,
    summarise,
)
from app.services.execution.runtimes import (
    display_name,
    get_runtime,
    normalise_language,
)

logger = structlog.get_logger()

REVIEW_TIMEOUT_S = 20.0
SIMULATION_TIMEOUT_S = 45.0
_COMMENT_ONLY = re.compile(r"^\s*(#|//|/\*|\*|<!--)")


# ── static pre-checks ─────────────────────────────────────────────────────────


def _strip_noise(code: str) -> str:
    """Code with comments and blank lines removed, for emptiness checks."""
    lines = [
        line for line in code.splitlines()
        if line.strip() and not _COMMENT_ONLY.match(line)
    ]
    return "\n".join(lines).strip()


def _is_placeholder_body(code: str) -> bool:
    body = _strip_noise(code)
    if not body:
        return True
    stripped = re.sub(r"\s+", " ", body)
    return stripped in {"pass", "return", "return None", "return null", "{}", "return;"}


def _ignores_parameters(code: str, entry_point: str | None) -> bool:
    """Python-only heuristic: does the entry function use any of its arguments?"""
    if not entry_point:
        return False
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return False
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if node.name != entry_point:
            continue
        params = {
            arg.arg
            for arg in [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
            if arg.arg not in {"self", "cls"}
        }
        if not params:
            return False
        used = {
            inner.id for inner in ast.walk(node) if isinstance(inner, ast.Name)
        }
        return not (params & used)
    return False


def _static_warnings(question: CodingQuestion, code: str) -> list[str]:
    warnings: list[str] = []
    if question.language.lower().startswith("py") and _ignores_parameters(
        code, question.entry_point
    ):
        warnings.append(
            "Your function never uses its parameters — it returns the same thing "
            "for every input."
        )
    return warnings


def _reject(
    status: str, feedback: str, total: int, *, sample_only: bool
) -> CodingGradeResponse:
    return CodingGradeResponse(
        status=status,  # type: ignore[arg-type]
        test_cases_passed=0,
        total_test_cases=total,
        feedback=feedback,
        engine="executed",
        results=[],
        sample_only=sample_only,
    )


# ── test selection ────────────────────────────────────────────────────────────


def _select_cases(question: CodingQuestion, sample_only: bool) -> list[CodingTestCase]:
    cases = list(question.test_cases)
    if not sample_only:
        return cases
    visible = [case for case in cases if not case.hidden]
    return visible or cases[:2]


def _case_payload(case: CodingTestCase) -> dict[str, Any]:
    return {
        "name": case.name,
        "args": case.args or [],
        "kwargs": case.kwargs or {},
        "stdin": case.stdin,
        "expected": case.expected,
        "expected_stdout": case.expected_stdout,
        "hidden": case.hidden,
    }


def _to_result(
    outcome: TestOutcome, *, label: str | None = None, redact: bool = True
) -> CodingTestResult:
    """Convert an execution outcome into an API result.

    This is the single place hidden cases get redacted — the engine reports
    everything it saw, and only what leaves the server is trimmed.
    """
    hide = outcome.hidden and redact
    return CodingTestResult(
        index=outcome.index,
        name=label or outcome.name or f"Case {outcome.index + 1}",
        hidden=hide,
        passed=outcome.passed,
        skipped=outcome.skipped,
        input_display=None if hide else outcome.input_display,
        expected_display=None if hide else outcome.expected_display,
        actual_display=None if hide else outcome.actual_display,
        stdout=None if hide else outcome.stdout,
        error=_redact_paths(outcome.error),
        duration_ms=outcome.duration_ms,
    )


_SANDBOX_PATH = re.compile(r'(?:/private)?/(?:var|tmp)/[\w./-]*bunker-exec-[\w./-]*')


def _redact_paths(text: str | None) -> str | None:
    """Strip sandbox temp paths out of tracebacks — they leak nothing useful."""
    if not text:
        return text
    return _SANDBOX_PATH.sub("<submission>", text)


def _reveal_first_failure(outcome: ExecutionOutcome) -> list[CodingTestResult]:
    """Show the learner the first hidden case they failed, LeetCode-style.

    Passing hidden cases stay hidden; one concrete counter-example is what makes
    a failure actionable without handing over the whole suite.
    """
    results: list[CodingTestResult] = []
    revealed = False
    for outcome_item in outcome.results:
        reveal_this = (
            outcome_item.hidden
            and not outcome_item.passed
            and not outcome_item.skipped
            and not revealed
        )
        result = _to_result(outcome_item, redact=not reveal_this)
        if reveal_this:
            result.name = "Hidden case (revealed)"
            revealed = True
        results.append(result)
    return results


# ── AI prose review layered on a real verdict ─────────────────────────────────


async def _write_review(
    question: CodingQuestion,
    code: str,
    outcome: ExecutionOutcome,
    fallback: str,
) -> str:
    failures = [
        result
        for result in outcome.results
        if not result.passed and not result.skipped
    ][:2]
    failure_text = "\n".join(
        f"- case {result.index + 1}"
        + (f" input: {result.input_display}" if result.input_display else " (hidden)")
        + (f" | expected: {result.expected_display}" if result.expected_display else "")
        + (f" | got: {result.actual_display}" if result.actual_display else "")
        + (f" | error: {result.error[:300]}" if result.error else "")
        for result in failures
    ) or "(none)"

    prompt = f"""\
Problem: {question.title}
Language: {question.language}
Type: {question.type}

[STATEMENT]
{question.problem[:1500]}

[STUDENT SUBMISSION]
{code[:4000]}

[FINAL VERDICT — decided by really executing the code, do not dispute it]
Status: {outcome.status}
Test cases passed: {outcome.passed} of {outcome.total}

[FAILING CASES]
{failure_text}

[COMPILER / RUNTIME OUTPUT]
{(outcome.compiler_output or "(none)")[:1200]}

Write the feedback now.
"""
    try:
        provider = get_provider("azure")
        text = ""

        async def collect() -> None:
            nonlocal text
            async for event in provider.stream_chat(
                [
                    {"role": "system", "content": REVIEW_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=320,
            ):
                if event.type == "delta":
                    text += event.text

        await asyncio.wait_for(collect(), timeout=REVIEW_TIMEOUT_S)
        cleaned = text.strip()
        return cleaned or fallback
    except Exception as exc:  # noqa: BLE001 — review is a nicety, never a blocker
        logger.warning("coding.review.unavailable", error=str(exc))
        return fallback


# ── trace questions ───────────────────────────────────────────────────────────


def _normalise_output(text: str) -> str:
    return "\n".join(line.rstrip() for line in (text or "").strip().splitlines())


async def grade_trace(question: CodingQuestion, answer: str) -> CodingGradeResponse:
    """Compare the learner's predicted output with the program's real output."""
    expected = question.expected_output
    if expected is None:
        try:
            result = await run_program(
                question.language,
                question.code_snippet or question.solution,
                time_limit_ms=question.time_limit_ms,
            )
            if result.exit_code == 0 and not result.timed_out:
                expected = _normalise_output(result.stdout)
        except RuntimeUnavailable:
            expected = None

    if expected is None:
        raise RuntimeUnavailable(question.language, "cannot execute the trace snippet")

    submitted = _normalise_output(answer)
    if not submitted:
        return _reject(
            "Wrong Answer",
            "Type the output you expect the program to print, then submit.",
            1,
            sample_only=False,
        )

    exact = submitted == expected
    loose = submitted.split() == expected.split()
    passed = exact or loose

    feedback = (
        "Correct — that is exactly what the program prints."
        if exact
        else (
            "Correct values, but the whitespace or line breaks differ from the real output."
            if loose
            else "Not the output this program produces. Re-trace it line by line, "
            "watching the order of operations and how each variable changes."
        )
    )

    return CodingGradeResponse(
        status="Accepted" if passed else "Wrong Answer",
        test_cases_passed=1 if passed else 0,
        total_test_cases=1,
        feedback=feedback,
        engine="executed",
        results=[
            CodingTestResult(
                index=0,
                name="Predicted output",
                hidden=False,
                passed=passed,
                input_display="(the program above)",
                expected_display=expected if passed else None,
                actual_display=submitted,
                duration_ms=0,
            )
        ],
    )


# ── executed grading ──────────────────────────────────────────────────────────


async def grade_by_execution(
    question: CodingQuestion,
    code: str,
    *,
    sample_only: bool,
) -> CodingGradeResponse:
    """Run the submission for real. Raises RuntimeUnavailable if it cannot."""
    if question.type == "trace":
        return await grade_trace(question, code)

    cases = _select_cases(question, sample_only)
    if not cases:
        raise RuntimeUnavailable(question.language, "question has no executable tests")

    if _is_placeholder_body(code):
        return _reject(
            "Wrong Answer",
            "There is no solution to run yet — implement the function body, then submit.",
            len(cases),
            sample_only=sample_only,
        )
    if question.code_snippet and code.strip() == question.code_snippet.strip():
        return _reject(
            "Wrong Answer",
            "This is still the starter code, unchanged. Make your edit and run it again.",
            len(cases),
            sample_only=sample_only,
        )

    outcome = await run_test_suite(
        question.language,
        code,
        [_case_payload(case) for case in cases],
        entry_point=question.entry_point,
        io_mode=question.io_mode,
        comparison=question.comparison,
        float_tolerance=question.float_tolerance,
        time_limit_ms=question.time_limit_ms,
    )

    results = _reveal_first_failure(outcome)
    hidden_total = sum(1 for case in cases if case.hidden)
    hidden_passed = sum(
        1
        for item, case in zip(outcome.results, cases)
        if case.hidden and item.passed
    )

    warnings = _static_warnings(question, code)
    if (
        outcome.status != "Accepted"
        and hidden_total
        and hidden_passed == 0
        and outcome.passed > 0
    ):
        warnings.append(
            "Every visible case passes but no hidden case does — this usually "
            "means the answer is hardcoded rather than computed."
        )

    fallback = outcome.message or summarise(outcome)
    feedback = await _write_review(question, code, outcome, fallback)

    return CodingGradeResponse(
        status=outcome.status,  # type: ignore[arg-type]
        test_cases_passed=outcome.passed,
        total_test_cases=outcome.total,
        feedback=feedback,
        compiler_output=outcome.compiler_output,
        engine="executed",
        results=results,
        runtime_ms=outcome.runtime_ms,
        hidden_passed=hidden_passed,
        hidden_total=hidden_total,
        sample_only=sample_only,
        warnings=warnings,
    )


# ── simulated grading (no runtime available) ──────────────────────────────────


async def grade_by_simulation(
    question: CodingQuestion,
    code: str,
    *,
    sample_only: bool,
    reason: str,
) -> CodingGradeResponse:
    """Last resort: have the model trace the code by hand, and say so."""
    language = normalise_language(question.language)
    if _is_placeholder_body(code):
        return CodingGradeResponse(
            status="Wrong Answer",
            test_cases_passed=0,
            total_test_cases=max(len(question.test_cases), 1),
            feedback="There is no solution to check yet — write the implementation first.",
            engine="simulated",
            sample_only=sample_only,
            warnings=[reason],
        )

    examples_text = "\n".join(
        f"Example {index + 1}: input {example.input} → output {example.output}"
        for index, example in enumerate(question.examples)
    ) or "(none provided)"

    cases_text = "\n".join(
        f"Case {index + 1}: "
        + (
            f"stdin={case.stdin!r} → stdout={case.expected_stdout!r}"
            if case.stdin is not None
            else f"args={json.dumps(case.args or [], default=repr)} → returns "
            f"{json.dumps(case.expected, default=repr)}"
        )
        for index, case in enumerate(question.test_cases[:10])
    ) or "(no structured cases — derive at least 5 of your own, including edge cases)"

    prompt = f"""\
Problem Title: {question.title}
Language: {display_name(language)}
Question Type: {question.type}
Entry point: {question.entry_point or "(whole program, reads stdin)"}

[PROBLEM STATEMENT]
{question.problem}

[CONSTRAINTS]
{chr(10).join(f"- {c}" for c in question.constraints) or "(none)"}

[EXAMPLES]
{examples_text}

[TEST CASES TO CHECK]
{cases_text}

[REFERENCE SOLUTION]
{question.solution}

[STUDENT SUBMISSION]
{code}

Trace the submission against every test case and return the JSON object.
"""

    provider = get_provider("azure")
    text = ""

    async def collect() -> None:
        nonlocal text
        async for event in provider.stream_chat(
            [
                {"role": "system", "content": SIMULATION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1600,
        ):
            if event.type == "delta":
                text += event.text

    try:
        await asyncio.wait_for(collect(), timeout=SIMULATION_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning("coding.simulate.timeout", language=language)

    data = _parse_json_object(text)
    total = int(data.get("total_test_cases") or len(question.test_cases) or 5)
    passed = max(0, min(int(data.get("test_cases_passed") or 0), total))
    status = data.get("status") or "Wrong Answer"
    if status not in {
        "Accepted",
        "Wrong Answer",
        "Runtime Error",
        "Compilation Error",
        "Time Limit Exceeded",
    }:
        status = "Wrong Answer"
    if status == "Accepted" and passed < total:
        passed = total

    return CodingGradeResponse(
        status=status,  # type: ignore[arg-type]
        test_cases_passed=passed,
        total_test_cases=total,
        feedback=data.get("feedback") or "No feedback was produced for this submission.",
        compiler_output=data.get("compiler_output"),
        engine="simulated",
        results=[],
        sample_only=sample_only,
        warnings=[reason],
    )


def _parse_json_object(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                pass
    return {}


# ── entry point ───────────────────────────────────────────────────────────────


async def grade(
    question: CodingQuestion,
    code: str,
    *,
    sample_only: bool = False,
) -> CodingGradeResponse:
    """Grade a submission, executing it whenever that is possible."""
    language = normalise_language(question.language)
    runtime = get_runtime(language)

    if runtime.available and question.is_executable:
        try:
            return await grade_by_execution(question, code, sample_only=sample_only)
        except RuntimeUnavailable as exc:
            reason = exc.reason
        except Exception as exc:  # noqa: BLE001 — degrade, never 500 on a submission
            logger.exception("coding.grade.execution_failed", error=str(exc))
            reason = "The sandbox could not run this submission."
    elif not runtime.available:
        reason = (
            f"{display_name(language)} is not installed on the grading server, so "
            "this submission was reviewed by AI instead of being executed."
        )
    else:
        reason = (
            "This question was created before automatic test running, so it was "
            "reviewed by AI instead of being executed."
        )

    return await grade_by_simulation(
        question, code, sample_only=sample_only, reason=reason
    )
