"""Orchestration: turn a submission + test cases into a real verdict.

Two grading modes:

``function``  the harness imports the submission, calls the entry point once
              per case and compares return values. Available for Python,
              JavaScript and TypeScript.
``stdio``     the submission is run as a whole program, once per case, with the
              case's stdin piped in and its stdout compared. Works for every
              language, including compiled ones.

Nothing here trusts the model: a case only passes if the process actually
produced the expected value.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Sequence

import structlog

from app.services.execution.harnesses import JS_HARNESS_SUFFIX, PYTHON_HARNESS
from app.services.execution.runtimes import (
    get_runtime,
    get_spec,
    normalise_language,
    supports_function_mode,
)
from app.services.execution.sandbox import (
    ProcessResult,
    run_process,
    workspace,
    write_file,
)

logger = structlog.get_logger()

DEFAULT_TIME_LIMIT_MS = 4000
MAX_TESTS = 30
_TOTAL_BUDGET_S = 14.0

Status = str  # Accepted | Wrong Answer | Runtime Error | Compilation Error | Time Limit Exceeded


@dataclass(slots=True)
class TestOutcome:
    index: int
    passed: bool
    name: str | None = None
    hidden: bool = False
    input_display: str | None = None
    expected_display: str | None = None
    actual_display: str | None = None
    stdout: str | None = None
    error: str | None = None
    duration_ms: int = 0
    skipped: bool = False
    # Raw JSON-serialisable return value, used to repair generated test cases
    # against what the reference solution actually produces.
    actual_value: Any = None


@dataclass(slots=True)
class ExecutionOutcome:
    executed: bool
    status: Status
    passed: int
    total: int
    results: list[TestOutcome] = field(default_factory=list)
    compiler_output: str | None = None
    message: str | None = None
    runtime_ms: int = 0
    unavailable_reason: str | None = None

    @property
    def all_passed(self) -> bool:
        return self.total > 0 and self.passed == self.total


class RuntimeUnavailable(RuntimeError):
    """Raised when the host has no toolchain for the requested language."""

    def __init__(self, language: str, reason: str) -> None:
        super().__init__(reason)
        self.language = language
        self.reason = reason


# ── helpers ───────────────────────────────────────────────────────────────────


def _render(value: Any, limit: int = 600) -> str:
    if value is None:
        return "null"
    if isinstance(value, str):
        text = value
    else:
        try:
            text = json.dumps(value, ensure_ascii=False, default=repr)
        except (TypeError, ValueError):
            text = repr(value)
    return text if len(text) <= limit else text[:limit] + " …"


def _case_input_display(case: dict[str, Any]) -> str:
    if case.get("stdin") is not None:
        return str(case["stdin"])
    args = case.get("args")
    if args:
        return ", ".join(_render(a, 160) for a in args)
    return "(no input)"


def _case_expected_display(case: dict[str, Any]) -> str:
    if case.get("expected_stdout") is not None:
        return str(case["expected_stdout"])
    return _render(case.get("expected"))


def _normalise_stdout(text: str) -> str:
    lines = [line.rstrip() for line in (text or "").strip().splitlines()]
    return "\n".join(lines)


def _numbers(text: str) -> list[str]:
    return re.findall(r"-?\d+(?:\.\d+)?", text or "")


def _stdout_matches(actual: str, expected: str, comparison: str) -> bool:
    left, right = _normalise_stdout(actual), _normalise_stdout(expected)
    if comparison == "exact":
        return (actual or "") == (expected or "")
    if left == right:
        return True
    if comparison == "ignore_case" and left.lower() == right.lower():
        return True
    # Whitespace-insensitive token comparison — the usual judge convention.
    if left.split() == right.split():
        return True
    if comparison == "float":
        left_nums, right_nums = _numbers(left), _numbers(right)
        if left_nums and len(left_nums) == len(right_nums):
            try:
                return all(
                    abs(float(a) - float(b)) <= 1e-6 * max(1.0, abs(float(b)))
                    for a, b in zip(left_nums, right_nums)
                )
            except ValueError:
                return False
    if comparison == "unordered":
        return sorted(left.split()) == sorted(right.split())
    return False


def _classify(results: Sequence[TestOutcome]) -> Status:
    if not results:
        return "Wrong Answer"
    if all(r.passed for r in results if not r.skipped):
        return "Accepted" if any(not r.skipped for r in results) else "Wrong Answer"
    for result in results:
        if result.error and "Time Limit" in result.error:
            return "Time Limit Exceeded"
    if any(result.error for result in results):
        return "Runtime Error"
    return "Wrong Answer"


def _java_source_name(code: str) -> str:
    match = re.search(r"\bpublic\s+(?:final\s+|abstract\s+)*class\s+(\w+)", code)
    return f"{match.group(1)}.java" if match else "Main.java"


# ── public API ────────────────────────────────────────────────────────────────


async def run_program(
    language: str,
    code: str,
    *,
    stdin: str | None = None,
    time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
) -> ProcessResult:
    """Compile (if needed) and run a standalone program once.

    Used to trace expected output and to sanity-check reference solutions.
    """
    language = normalise_language(language)
    runtime = get_runtime(language)
    if not runtime.available:
        raise RuntimeUnavailable(language, runtime.reason or "runtime unavailable")

    spec = get_spec(language)
    async with workspace() as work:
        name = _java_source_name(code) if language == "java" else spec.source_name
        source = write_file(work, name, code)

        if spec.compile_argv is not None:
            compiled = await run_process(
                spec.compile_argv(work, source),
                cwd=work,
                timeout_s=spec.compile_timeout_s,
                memory_mb=None,
            )
            if not compiled.ok:
                return ProcessResult(
                    exit_code=compiled.exit_code or 1,
                    stdout="",
                    stderr=compiled.stderr or compiled.stdout or "Compilation failed.",
                    duration_ms=compiled.duration_ms,
                )

        return await run_process(
            spec.run_argv(work, source),
            cwd=work,
            stdin=stdin,
            timeout_s=max(0.5, time_limit_ms / 1000),
            memory_mb=spec.memory_mb,
        )


async def run_test_suite(
    language: str,
    code: str,
    tests: Sequence[dict[str, Any]],
    *,
    entry_point: str | None = None,
    io_mode: str = "function",
    comparison: str = "trim",
    float_tolerance: float = 1e-6,
    time_limit_ms: int = DEFAULT_TIME_LIMIT_MS,
    reveal_hidden: bool = False,
) -> ExecutionOutcome:
    """Execute ``code`` against ``tests`` and return a per-case verdict."""
    language = normalise_language(language)
    runtime = get_runtime(language)
    if not runtime.available:
        raise RuntimeUnavailable(language, runtime.reason or "runtime unavailable")

    cases = list(tests)[:MAX_TESTS]
    if not cases:
        return ExecutionOutcome(
            executed=False,
            status="Wrong Answer",
            passed=0,
            total=0,
            message="This question has no runnable test cases.",
        )

    if io_mode == "function" and not supports_function_mode(language):
        io_mode = "stdio"

    if io_mode == "function":
        return await _run_function_mode(
            language,
            code,
            cases,
            entry_point=entry_point,
            comparison=comparison,
            float_tolerance=float_tolerance,
            time_limit_ms=time_limit_ms,
            reveal_hidden=reveal_hidden,
        )
    return await _run_stdio_mode(
        language,
        code,
        cases,
        comparison=comparison,
        time_limit_ms=time_limit_ms,
        reveal_hidden=reveal_hidden,
    )


# ── function mode ─────────────────────────────────────────────────────────────


async def _run_function_mode(
    language: str,
    code: str,
    cases: list[dict[str, Any]],
    *,
    entry_point: str | None,
    comparison: str,
    float_tolerance: float,
    time_limit_ms: int,
    reveal_hidden: bool,
) -> ExecutionOutcome:
    spec = get_spec(language)
    budget_s = min(_TOTAL_BUDGET_S, max(2.0, (time_limit_ms / 1000) * len(cases) + 2.0))

    payload = {
        "entry_point": entry_point,
        "comparison": comparison,
        "float_tolerance": float_tolerance,
        "tests": [
            {
                "args": case.get("args") or [],
                "kwargs": case.get("kwargs") or {},
                "expected": case.get("expected"),
                "expected_stdout": case.get("expected_stdout"),
                "stdin": case.get("stdin"),
            }
            for case in cases
        ],
    }

    async with workspace() as work:
        result_path = work / "result.json"
        spec_path = write_file(work, "spec.json", json.dumps(payload))

        if language == "python":
            source = write_file(work, spec.source_name, code)
            entry_file = write_file(work, "harness.py", PYTHON_HARNESS)
            argv = spec.run_argv(work, entry_file)
            env = {
                "BUNKER_SPEC": str(spec_path),
                "BUNKER_RESULT": str(result_path),
                "BUNKER_SOURCE": str(source),
            }
        else:
            source = write_file(work, spec.source_name, code + JS_HARNESS_SUFFIX)
            argv = spec.run_argv(work, source)
            env = {"BUNKER_SPEC": str(spec_path), "BUNKER_RESULT": str(result_path)}

        process = await run_process(
            argv,
            cwd=work,
            timeout_s=budget_s,
            memory_mb=spec.memory_mb,
            env=env,
        )

        raw = ""
        if result_path.exists():
            raw = result_path.read_text(encoding="utf-8", errors="replace")

    return _interpret_function_run(
        raw, process, cases, comparison=comparison, reveal_hidden=reveal_hidden
    )


def _interpret_function_run(
    raw: str,
    process: ProcessResult,
    cases: list[dict[str, Any]],
    *,
    comparison: str,
    reveal_hidden: bool,
) -> ExecutionOutcome:
    payload: dict[str, Any] = {}
    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}

    fatal = payload.get("fatal")
    fatal_kind = payload.get("fatal_kind")

    if fatal:
        status = "Compilation Error" if fatal_kind == "compile" else "Runtime Error"
        message = fatal if fatal_kind != "entry" else fatal
        return ExecutionOutcome(
            executed=True,
            status=status,
            passed=0,
            total=len(cases),
            results=[
                _skipped_outcome(index, case, reveal_hidden)
                for index, case in enumerate(cases)
            ],
            compiler_output=fatal,
            message=message,
            runtime_ms=process.duration_ms,
        )

    records: list[dict[str, Any]] = payload.get("results") or []

    # The harness never got off the ground (syntax error the loader raised
    # outside our try, missing interpreter, OOM kill…).
    if not records and not payload:
        stderr = (process.stderr or "").strip()
        looks_like_syntax = "SyntaxError" in stderr or "error TS" in stderr
        status = "Compilation Error" if looks_like_syntax else "Runtime Error"
        if process.timed_out:
            status = "Time Limit Exceeded"
        return ExecutionOutcome(
            executed=True,
            status=status,
            passed=0,
            total=len(cases),
            results=[
                _skipped_outcome(index, case, reveal_hidden)
                for index, case in enumerate(cases)
            ],
            compiler_output=stderr or process.stdout or None,
            message=(
                "Your submission timed out before any test case finished."
                if process.timed_out
                else "Your code crashed before any test case could run."
            ),
            runtime_ms=process.duration_ms,
        )

    outcomes: list[TestOutcome] = []
    for index, case in enumerate(cases):
        hidden = bool(case.get("hidden")) and not reveal_hidden
        record = records[index] if index < len(records) else None

        if record is None:
            timed_out_here = process.timed_out and index == len(records)
            outcome = _skipped_outcome(index, case, reveal_hidden)
            if timed_out_here:
                outcome.skipped = False
                outcome.error = "Time Limit Exceeded — this test case did not finish in time."
            outcomes.append(outcome)
            continue

        outcomes.append(
            TestOutcome(
                index=index,
                passed=bool(record.get("passed")),
                name=case.get("name"),
                hidden=hidden,
                input_display=_case_input_display(case),
                expected_display=_case_expected_display(case),
                actual_display=record.get("actual"),
                stdout=record.get("stdout") or None,
                error=record.get("error"),
                duration_ms=int(record.get("duration_ms") or 0),
                actual_value=record.get("actual_value"),
            )
        )

    passed = sum(1 for outcome in outcomes if outcome.passed)
    status = _classify(outcomes)
    if process.timed_out and status != "Accepted":
        status = "Time Limit Exceeded"

    setup_stdout = (payload.get("setup_stdout") or "").strip()
    return ExecutionOutcome(
        executed=True,
        status=status,
        passed=passed,
        total=len(cases),
        results=outcomes,
        compiler_output=setup_stdout or (process.stderr.strip() or None),
        runtime_ms=process.duration_ms,
    )


def _skipped_outcome(index: int, case: dict[str, Any], reveal_hidden: bool) -> TestOutcome:
    hidden = bool(case.get("hidden")) and not reveal_hidden
    return TestOutcome(
        index=index,
        passed=False,
        name=case.get("name"),
        hidden=hidden,
        input_display=_case_input_display(case),
        expected_display=_case_expected_display(case),
        actual_display=None,
        stdout=None,
        error=None,
        duration_ms=0,
        skipped=True,
    )


# ── stdio mode ────────────────────────────────────────────────────────────────


async def _run_stdio_mode(
    language: str,
    code: str,
    cases: list[dict[str, Any]],
    *,
    comparison: str,
    time_limit_ms: int,
    reveal_hidden: bool,
) -> ExecutionOutcome:
    spec = get_spec(language)
    per_test_s = max(0.5, time_limit_ms / 1000)

    async with workspace() as work:
        name = _java_source_name(code) if language == "java" else spec.source_name
        source = write_file(work, name, code)

        if spec.compile_argv is not None:
            compiled = await run_process(
                spec.compile_argv(work, source),
                cwd=work,
                timeout_s=spec.compile_timeout_s,
                memory_mb=None,
            )
            if not compiled.ok:
                detail = (compiled.stderr or compiled.stdout or "Compilation failed.").strip()
                return ExecutionOutcome(
                    executed=True,
                    status="Compilation Error",
                    passed=0,
                    total=len(cases),
                    results=[
                        _skipped_outcome(index, case, reveal_hidden)
                        for index, case in enumerate(cases)
                    ],
                    compiler_output=detail,
                    message="Your code did not compile.",
                    runtime_ms=compiled.duration_ms,
                )

        run_argv = spec.run_argv(work, source)
        outcomes: list[TestOutcome] = []
        total_ms = 0
        spent_s = 0.0

        for index, case in enumerate(cases):
            hidden = bool(case.get("hidden")) and not reveal_hidden
            if spent_s >= _TOTAL_BUDGET_S:
                outcome = _skipped_outcome(index, case, reveal_hidden)
                outcome.error = "Skipped — the grader ran out of time budget."
                outcomes.append(outcome)
                continue

            process = await run_process(
                run_argv,
                cwd=work,
                stdin=case.get("stdin") or "",
                timeout_s=per_test_s,
                memory_mb=spec.memory_mb,
            )
            total_ms += process.duration_ms
            spent_s += process.duration_ms / 1000

            expected = case.get("expected_stdout")
            if expected is None and case.get("expected") is not None:
                expected = (
                    case["expected"]
                    if isinstance(case["expected"], str)
                    else _render(case["expected"])
                )

            error: str | None = None
            passed = False
            if process.timed_out:
                error = f"Time Limit Exceeded (> {per_test_s:.1f}s)"
            elif process.exit_code != 0:
                error = (process.stderr or "").strip()[-1200:] or (
                    f"Program exited with code {process.exit_code}"
                    + (f" ({process.signal_name})" if process.signal_name else "")
                )
            else:
                passed = _stdout_matches(process.stdout, expected or "", comparison)

            outcomes.append(
                TestOutcome(
                    index=index,
                    passed=passed,
                    name=case.get("name"),
                    hidden=hidden,
                    input_display=_case_input_display(case),
                    expected_display=expected or "",
                    actual_display=_normalise_stdout(process.stdout),
                    stdout=process.stdout or None,
                    error=error,
                    duration_ms=process.duration_ms,
                    actual_value=_normalise_stdout(process.stdout),
                )
            )

    passed = sum(1 for outcome in outcomes if outcome.passed)
    return ExecutionOutcome(
        executed=True,
        status=_classify(outcomes),
        passed=passed,
        total=len(outcomes),
        results=outcomes,
        runtime_ms=total_ms,
    )


def summarise(outcome: ExecutionOutcome) -> str:
    """One-line human summary used when the model isn't asked for feedback."""
    if outcome.status == "Accepted":
        return f"All {outcome.total} test cases passed."
    if outcome.status == "Compilation Error":
        return "Your code failed to compile — fix the syntax errors and try again."
    if outcome.status == "Time Limit Exceeded":
        return "Your solution was too slow (or looped forever) on at least one case."
    if outcome.status == "Runtime Error":
        return "Your code crashed while running the tests."
    return f"{outcome.passed} of {outcome.total} test cases passed."


def failing_cases(outcome: ExecutionOutcome) -> Iterable[TestOutcome]:
    return (result for result in outcome.results if not result.passed)
