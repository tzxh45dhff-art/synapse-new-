"""Verify generated questions by actually running their reference solutions.

A language model writing test cases by hand gets expected values subtly wrong
all the time. Before a set is ever shown to a learner we:

  1. run the reference solution against every generated case;
  2. rewrite each expected value to what the reference really produced;
  3. drop cases the reference cannot survive;
  4. capture the true stdout for TRACE questions;
  5. sanity-check DEBUG starters (a "bug" that passes every test is not a bug).

Anything that survives is genuinely gradeable. Anything that does not is
flagged, and grading for that question falls back to AI review.
"""

from __future__ import annotations

import asyncio
from typing import Any

import structlog

from app.schemas.coding_schema import CodingQuestion, CodingTestCase
from app.services.execution.engine import RuntimeUnavailable, run_program, run_test_suite
from app.services.execution.runtimes import is_language_executable, normalise_language

logger = structlog.get_logger()

MIN_TESTS = 2
MAX_PARALLEL_VERIFICATIONS = 4
VERIFY_TIME_LIMIT_MS = 4000


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


async def verify_question(question: CodingQuestion) -> tuple[CodingQuestion, list[str]]:
    """Return the question with repaired tests, plus any warnings raised."""
    warnings: list[str] = []
    language = normalise_language(question.language)

    if not is_language_executable(language):
        return question, []

    if question.type == "trace":
        return await _verify_trace(question, warnings)

    if not question.test_cases:
        warnings.append(f"Q{question.number}: the model produced no test cases.")
        return question, warnings

    return await _verify_tests(question, warnings)


async def _verify_trace(
    question: CodingQuestion, warnings: list[str]
) -> tuple[CodingQuestion, list[str]]:
    program = question.code_snippet or question.solution
    if not program.strip():
        warnings.append(f"Q{question.number}: trace question has no program to run.")
        return question, warnings
    try:
        result = await run_program(
            question.language, program, time_limit_ms=VERIFY_TIME_LIMIT_MS
        )
    except RuntimeUnavailable:
        return question, warnings

    if result.exit_code != 0 or result.timed_out:
        warnings.append(
            f"Q{question.number}: the trace snippet does not run cleanly, so it "
            "will be graded by AI review instead."
        )
        logger.warning(
            "coding.verify.trace_failed",
            number=question.number,
            stderr=(result.stderr or "")[:300],
        )
        return question, warnings

    question.expected_output = "\n".join(
        line.rstrip() for line in result.stdout.strip().splitlines()
    )
    question.tests_verified = True
    question.test_cases = []
    return question, warnings


async def _verify_tests(
    question: CodingQuestion, warnings: list[str]
) -> tuple[CodingQuestion, list[str]]:
    cases = [_case_payload(case) for case in question.test_cases]

    try:
        reference = await run_test_suite(
            question.language,
            question.solution,
            cases,
            entry_point=question.entry_point,
            io_mode=question.io_mode,
            comparison=question.comparison,
            float_tolerance=question.float_tolerance,
            time_limit_ms=VERIFY_TIME_LIMIT_MS,
            reveal_hidden=True,
        )
    except RuntimeUnavailable:
        return question, warnings

    if reference.status in {"Compilation Error", "Runtime Error"} and reference.passed == 0:
        # The reference itself is broken — nothing here can be trusted.
        warnings.append(
            f"Q{question.number} (\"{question.title}\"): the reference solution does "
            "not run, so this question is graded by AI review."
        )
        logger.warning(
            "coding.verify.reference_broken",
            number=question.number,
            status=reference.status,
            detail=(reference.compiler_output or "")[:300],
        )
        question.test_cases = []
        question.tests_verified = False
        return question, warnings

    repaired: list[CodingTestCase] = []
    corrected = 0
    dropped = 0

    for index, case in enumerate(question.test_cases):
        outcome = reference.results[index] if index < len(reference.results) else None
        if outcome is None or outcome.skipped or outcome.error:
            dropped += 1
            continue

        if not outcome.passed:
            # Trust the code, not the model's arithmetic.
            if question.io_mode == "stdio":
                if outcome.actual_value is None:
                    dropped += 1
                    continue
                case.expected_stdout = str(outcome.actual_value)
                case.expected = None
            else:
                if outcome.actual_value is None:
                    dropped += 1
                    continue
                case.expected = outcome.actual_value
                case.expected_stdout = None
            corrected += 1

        repaired.append(case)

    if len(repaired) < MIN_TESTS:
        warnings.append(
            f"Q{question.number} (\"{question.title}\"): only {len(repaired)} test "
            "case(s) survived verification — falling back to AI review."
        )
        question.test_cases = []
        question.tests_verified = False
        return question, warnings

    # Guarantee at least one visible case so the learner can see the shape.
    if all(case.hidden for case in repaired):
        repaired[0].hidden = False

    question.test_cases = repaired
    question.tests_verified = True

    if corrected:
        logger.info(
            "coding.verify.expected_corrected",
            number=question.number,
            corrected=corrected,
            dropped=dropped,
        )
    if dropped:
        logger.info("coding.verify.cases_dropped", number=question.number, dropped=dropped)

    await _check_starter(question, warnings)
    return question, warnings


def _normalise_code(code: str) -> str:
    return "\n".join(line.rstrip() for line in code.strip().splitlines())


async def _check_starter(question: CodingQuestion, warnings: list[str]) -> None:
    """A DEBUG question whose starter already passes has no bug in it.

    Rather than hand the learner a "find the bug" exercise with no bug, the
    question is converted into a normal implement-it problem.
    """
    if question.type != "debug" or not question.code_snippet:
        return

    if _normalise_code(question.code_snippet) == _normalise_code(question.solution):
        _demote_to_solve(question, warnings, "its starter code was identical to the solution")
        return

    try:
        starter = await run_test_suite(
            question.language,
            question.code_snippet,
            [_case_payload(case) for case in question.test_cases],
            entry_point=question.entry_point,
            io_mode=question.io_mode,
            comparison=question.comparison,
            float_tolerance=question.float_tolerance,
            time_limit_ms=VERIFY_TIME_LIMIT_MS,
            reveal_hidden=True,
        )
    except RuntimeUnavailable:
        return

    if starter.status == "Accepted":
        _demote_to_solve(
            question, warnings, "its starter code already passed every test case"
        )


_STUB_BODY = {
    "python": "    pass\n",
    "javascript": "  // Your code here\n",
    "typescript": "  // Your code here\n",
}


def _demote_to_solve(question: CodingQuestion, warnings: list[str], why: str) -> None:
    """Turn a bug-free "debug" question into an implement-it question.

    Better to hand the learner an honest blank-slate problem than a hunt for a
    bug that isn't there.
    """
    logger.warning("coding.verify.debug_no_bug", number=question.number, reason=why)
    question.type = "solve"

    signature = _first_signature(question.solution)
    if signature:
        stub = _STUB_BODY.get(question.language, "    // Your code here\n")
        question.code_snippet = f"{signature}\n{stub}"
    else:
        question.code_snippet = None

    warnings.append(
        f"Q{question.number} (\"{question.title}\") became an implement-it problem "
        f"because {why}."
    )


def _first_signature(solution: str) -> str | None:
    """The opening line that declares the entry function, for a starter stub."""
    for line in solution.splitlines():
        stripped = line.strip()
        if stripped.startswith(("def ", "async def ", "function ", "public ", "func ")):
            return line.rstrip()
    return None


async def verify_questions(questions: list[CodingQuestion]) -> tuple[list[CodingQuestion], list[str]]:
    """Verify a whole set with bounded concurrency."""
    if not questions:
        return questions, []

    semaphore = asyncio.Semaphore(MAX_PARALLEL_VERIFICATIONS)

    async def guarded(question: CodingQuestion) -> tuple[CodingQuestion, list[str]]:
        async with semaphore:
            try:
                return await verify_question(question)
            except Exception as exc:  # noqa: BLE001 — verification must never break generation
                logger.warning(
                    "coding.verify.failed", number=question.number, error=str(exc)
                )
                return question, []

    settled = await asyncio.gather(*(guarded(question) for question in questions))
    verified = [question for question, _ in settled]
    warnings = [warning for _, batch in settled for warning in batch]
    return verified, warnings
