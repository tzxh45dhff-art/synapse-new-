"""Real code execution engine.

Runs user-submitted code in a resource-limited subprocess against structured
test cases. Replaces "ask the LLM to pretend it ran the code" grading, which
could not distinguish a real solution from a hardcoded print.

Public surface:
    detect_runtimes()  -> runtime availability map
    run_test_suite()   -> execute code against a list of test cases
    run_program()      -> execute a standalone program (used for TRACE questions)
"""

from app.services.execution.engine import (  # noqa: F401
    ExecutionOutcome,
    TestOutcome,
    run_program,
    run_test_suite,
)
from app.services.execution.runtimes import (  # noqa: F401
    RuntimeInfo,
    detect_runtimes,
    is_language_executable,
    normalise_language,
)
