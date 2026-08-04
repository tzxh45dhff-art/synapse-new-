"""Prompt construction for coding-question generation and AI-assisted review.

The generator is asked for an *executable contract* — an entry point, a
runnable reference solution and concrete test cases — not just prose. That
contract is what lets the grader run real code instead of guessing.
"""

from __future__ import annotations

from app.schemas.coding_schema import CodingGenerateRequest
from app.services.execution.runtimes import display_name, supports_function_mode

LANGUAGE_DISPLAY = display_name

_DIFFICULTY_GUIDANCE = {
    "easy": (
        "one core idea, 5–15 lines of solution code, no tricky edge cases; "
        "solvable by someone who just learned the topic"
    ),
    "medium": (
        "two ideas combined, or one standard algorithm applied carefully; "
        "the naive approach should be noticeably worse than the intended one"
    ),
    "hard": (
        "non-obvious insight required — tight complexity targets, awkward edge "
        "cases, or a less common algorithm/data structure"
    ),
    "mixed": "a deliberate spread: roughly a third easy, a third medium, a third hard",
}

_TYPE_GUIDANCE = {
    "solve": (
        "SOLVE — the learner implements the function from scratch.\n"
        "   starter_code: the signature plus a docstring/comment describing the "
        "contract, and an empty body (`pass`, `return null`, `// TODO`). It must "
        "parse cleanly but MUST NOT contain the answer.\n"
        "   solution: the complete, correct implementation."
    ),
    "debug": (
        "DEBUG — the learner finds and fixes bugs.\n"
        "   starter_code: a full implementation containing 1–2 deliberate, "
        "realistic bugs (off-by-one, wrong comparison operator, mutating while "
        "iterating, missing base case). It MUST still parse and run — it just "
        "produces wrong results. Do not mark the bug with a comment.\n"
        "   solution: the same code with the bugs fixed.\n"
        "   CRITICAL: starter_code and solution must NOT be the same code, and "
        "starter_code MUST fail at least two of your test cases. Before you "
        "output the question, run your own test cases against starter_code in "
        "your head and confirm it genuinely gives the wrong answer. A starter "
        "that passes every test is a rejected question.\n"
        "   problem: describe the intended behaviour and say that the code is "
        "buggy — never say where the bug is."
    ),
    "trace": (
        "TRACE — the learner predicts the exact printed output.\n"
        "   code_snippet: a self-contained, fully deterministic program of "
        "10–25 lines that prints something non-trivial. No input, no randomness, "
        "no clocks, no dictionary/set iteration order dependence.\n"
        "   solution: the same program (unchanged).\n"
        "   No test cases are needed for this type."
    ),
    "fill": (
        "FILL — the learner completes missing code.\n"
        "   starter_code: the working implementation with 1–3 crucial fragments "
        "replaced by `___`. Everything else stays intact.\n"
        "   solution: the complete implementation with the blanks filled in."
    ),
}

_FUNCTION_CONTRACT = """\
EXECUTION CONTRACT — function mode (this language supports it):
  "io_mode"     : "function"
  "entry_point" : the exact function name the learner must define
  "tests"       : array of {"name", "args", "expected", "hidden"} objects
      - "args"     : JSON array of the positional arguments, in order
      - "expected" : the value the function must RETURN (JSON), never printed output
      - "hidden"   : true for cases the learner cannot see before submitting

The function must be pure and deterministic:
  - it RETURNS its answer; it must not need to print anything
  - it never reads stdin, opens files, uses the network, or uses randomness
  - it uses only the standard library
"""

_STDIO_CONTRACT = """\
EXECUTION CONTRACT — stdio mode (this language is graded as a whole program):
  "io_mode"     : "stdio"
  "entry_point" : null
  "tests"       : array of {"name", "stdin", "expected_stdout", "hidden"} objects
      - "stdin"           : the exact text piped to the program (include newlines as \\n)
      - "expected_stdout" : the exact text the program must print
      - "hidden"          : true for cases the learner cannot see before submitting

Because there is no function to call:
  - starter_code and solution must both be COMPLETE programs with a main entry point
  - the problem statement MUST specify the input format and the output format precisely
  - the program reads from standard input and writes to standard output only
"""

_TEST_RULES = """\
TEST CASE RULES (this is the part that makes the question actually gradeable):
  - Give 6 to 9 test cases per question.
  - The FIRST 2 are visible ("hidden": false) and must match the "examples" exactly.
  - All the rest are hidden ("hidden": true).
  - Hidden cases must include genuine edge cases: empty input, a single element,
    duplicates, negative numbers, the smallest and largest allowed values,
    already-sorted and reverse-sorted input, and any case where a naive or
    hardcoded answer would be wrong.
  - Every hidden case must have a DIFFERENT answer from the visible ones wherever
    the problem allows it, so that returning a constant cannot pass.
  - "expected" must be EXACTLY what the reference solution produces. Compute it
    by hand, carefully. Do not guess.
  - Arguments and expected values must be plain JSON LITERALS ONLY: numbers,
    strings, true/false/null, arrays, objects. This is strict JSON, not Python
    or JavaScript — every one of these is FORBIDDEN and breaks the parser:
        [1] * 100000      3 * [0]        list(range(50))     "a" + "b"
        True / False / None (write true / false / null)
        1_000_000 (write 1000000)         float('inf')       // comments
  - Keep every test input small enough to write out in full — at most about
    30 elements. Test correctness and edge cases, not performance.
"""

SYSTEM_PROMPT = """\
You are a senior interview-question author and compiler engineer. You write \
coding problems that are precise enough to be auto-graded by really executing code.

Output ONLY a raw JSON array. No prose, no markdown fences, no trailing commas.

Each element must have EXACTLY these keys:
  "number"              : integer, 1-based
  "type"                : "solve" | "debug" | "trace" | "fill"
  "title"               : short, specific, ≤ 60 chars (never "Question 1")
  "language"            : the programming language, lowercase
  "difficulty"          : "easy" | "medium" | "hard"
  "topic_hint"          : the sub-topic being tested, or null
  "problem"             : plain-text statement — what to do, the exact input and
                          output types, and any guarantees. Self-contained.
  "starter_code"        : the code shown in the editor (see the type rules)
  "solution"            : a COMPLETE, RUNNABLE reference implementation
  "solution_explanation": 2–4 sentences on the approach and why it is correct
  "complexity"          : e.g. "O(n) time, O(1) space"
  "examples"            : 2 items of {"input","output","explanation"} — human-readable
  "constraints"         : 2–5 short strings bounding the input
  "hints"               : 3 progressive hints; the first nudges, the last is
                          nearly the algorithm, but none contain the answer code
  "io_mode"             : see the execution contract
  "entry_point"         : see the execution contract
  "tests"               : see the execution contract
  "comparison"          : "trim" (default) | "exact" | "ignore_case" |
                          "unordered" (any order accepted) | "float" (tolerance)

Hard requirements:
  - The reference solution MUST run as-is and pass every one of your own tests.
    It will be executed. If it fails, the question is discarded.
  - Real, idiomatic code — never pseudocode, never "..." placeholders.
  - No markdown backticks anywhere inside JSON strings. Escape newlines as \\n.
  - Every question must be distinct in both concept and title.
  - The output must parse with a strict JSON parser on the first attempt.
"""


def build_generation_prompt(
    req: CodingGenerateRequest,
    *,
    subject_name: str | None,
    language: str,
    batch_count: int,
    batch_types: list[str],
    context_chunks: list[str],
    exact_mode: bool,
    avoid_titles: list[str],
    start_number: int,
) -> str:
    lang_display = LANGUAGE_DISPLAY(language)
    function_mode = supports_function_mode(language)
    parts: list[str] = []

    if subject_name:
        parts.append(f"Subject: {subject_name}")
    parts.append(f"Programming language: {lang_display}")
    parts.append(
        f"Difficulty: {req.difficulty} — {_DIFFICULTY_GUIDANCE.get(req.difficulty, '')}"
    )
    parts.append(
        f"Generate exactly {batch_count} question(s), numbered "
        f"{start_number} to {start_number + batch_count - 1}."
    )

    parts.append("\nQuestion types to produce (distribute them evenly):")
    for question_type in batch_types:
        parts.append(f"  • {_TYPE_GUIDANCE[question_type]}")

    parts.append(f"\nTopics / syllabus:\n{req.topics}")

    parts.append("\n" + (_FUNCTION_CONTRACT if function_mode else _STDIO_CONTRACT))
    parts.append(_TEST_RULES)

    if "trace" in batch_types:
        parts.append(
            "For TRACE questions only: set \"tests\" to [], \"entry_point\" to null, "
            "and put the program in both \"starter_code\" and \"solution\". "
            "The learner types the predicted output, which is checked against the "
            "program's real output."
        )

    if context_chunks:
        limit = 12 if exact_mode else 6
        combined = "\n\n---\n\n".join(context_chunks[:limit])
        label = (
            "Source material — extract real questions from this"
            if exact_mode
            else "Context from the learner's study materials — ground the questions in it"
        )
        parts.append(f"\n{label}:\n{combined}")

    if exact_mode:
        parts.append(
            "\nEXACT MODE: the source material above is a question bank or syllabus. "
            "Take real questions from it first, keeping their original wording, "
            "constraints and examples, translating the code into "
            f"{lang_display} if needed. If it contains fewer than {batch_count} usable "
            "questions, invent the rest in the same style on the same topics. "
            "Do not label which is which. Every question — extracted or invented — "
            "still needs a runnable reference solution and full test cases."
        )

    if avoid_titles:
        listed = "; ".join(avoid_titles)
        parts.append(
            f"\nAlready generated in this set — do NOT repeat these problems or "
            f"anything close to them: {listed}"
        )

    if req.custom_instruction:
        parts.append(f"\nExtra instruction from the learner: {req.custom_instruction}")

    parts.append(
        f"\nReturn only the JSON array of {batch_count} question object(s) in {lang_display}."
    )
    return "\n".join(parts)


REPAIR_SYSTEM_PROMPT = """\
You repair malformed JSON. The user sends text that was supposed to be a JSON \
array. Return the same content as a strictly valid JSON array — fix quoting, \
escaping, trailing commas and truncation by dropping any incomplete final \
element. Output only the JSON array, nothing else.
"""


# ── Review feedback (runs alongside real execution) ───────────────────────────

REVIEW_SYSTEM_PROMPT = """\
You are a patient code reviewer for a student practising a coding problem.

The submission has ALREADY been executed against the real test cases; the \
verdict is given to you and is final. Never contradict it, never re-judge \
correctness, never claim a test passed or failed differently.

Write 2–4 sentences of feedback that help the student move forward:
  - If it failed: name the most likely cause given the failing case, and point at
    the concept to revisit. Give a nudge, not the full corrected code.
  - If it passed: say what is good, then name one concrete improvement
    (complexity, edge-case handling, naming, or an idiom of the language).

Plain prose. No markdown headings, no code fences, no bullet lists.
"""


SIMULATION_SYSTEM_PROMPT = """\
You are a strict code judge. The server has no runtime installed for this \
language, so you must reason through the code by hand. Be conservative: when \
unsure, fail the submission.

Return ONLY a JSON object with these exact keys:
  "status"            : "Accepted" | "Wrong Answer" | "Runtime Error" | "Compilation Error" | "Time Limit Exceeded"
  "test_cases_passed" : integer
  "total_test_cases"  : integer
  "feedback"          : 2–4 sentences of specific, actionable review
  "compiler_output"   : string or null — the exact error text if it fails to compile or crashes

Judging rules — apply them literally:
  - Trace the code statement by statement for EVERY test case given.
  - Code that prints or returns a hardcoded constant matching the examples is
    "Wrong Answer", no matter how the constant is dressed up.
  - Code that only prints the answer when the function is required to RETURN it
    is "Wrong Answer".
  - Empty code, comments only, a bare `pass`/`return`, or pseudocode is
    "Compilation Error" or "Wrong Answer" — never "Accepted".
  - Any syntax error is "Compilation Error"; any uncaught exception is
    "Runtime Error"; state the exact exception in compiler_output.
  - "Accepted" requires that the code is a genuine general solution that you
    verified against every listed test case.
"""
