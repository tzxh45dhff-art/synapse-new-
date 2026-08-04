"""Language runtime registry and host capability detection.

The set of languages we can *really* execute depends on what is installed on
the host. Python always is (we are a Python service); everything else is
probed once at first use and cached. Callers use :func:`is_language_executable`
to decide between real execution and the AI fallback judge.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Callable, Literal

import structlog

logger = structlog.get_logger()

IOMode = Literal["function", "stdio"]

# Canonical language ids used across the API.
LANGUAGES = ("python", "javascript", "typescript", "java", "c", "cpp", "go")

_ALIASES = {
    "py": "python",
    "python3": "python",
    "js": "javascript",
    "node": "javascript",
    "nodejs": "javascript",
    "ts": "typescript",
    "c++": "cpp",
    "cplusplus": "cpp",
    "cxx": "cpp",
    "golang": "go",
    "jdk": "java",
}

DISPLAY_NAMES = {
    "python": "Python",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "java": "Java",
    "c": "C",
    "cpp": "C++",
    "go": "Go",
}

# Languages where we can drive a user-defined function directly. Everything
# else is graded through stdin/stdout, which every language supports.
FUNCTION_MODE_LANGUAGES = frozenset({"python", "javascript", "typescript"})


def normalise_language(language: str | None) -> str:
    """Map any spelling of a language onto its canonical id."""
    if not language:
        return "python"
    key = language.strip().lower()
    key = _ALIASES.get(key, key)
    return key if key in LANGUAGES else "python"


def display_name(language: str) -> str:
    return DISPLAY_NAMES.get(normalise_language(language), language)


def supports_function_mode(language: str) -> bool:
    return normalise_language(language) in FUNCTION_MODE_LANGUAGES


@dataclass(slots=True)
class RuntimeInfo:
    """What the host can actually do for one language."""

    language: str
    display: str
    available: bool
    version: str | None = None
    executable: str | None = None
    reason: str | None = None


@dataclass(slots=True)
class LanguageSpec:
    """How to turn source text into a running process."""

    language: str
    source_name: str
    # argv builders receive the workspace dir and the written source path.
    compile_argv: Callable[[Path, Path], list[str]] | None
    run_argv: Callable[[Path, Path], list[str]]
    probe: list[str]
    # Some toolchains (JVM, Go) reserve large virtual address spaces and die
    # under an RLIMIT_AS cap, so memory limiting is opt-out per language.
    memory_mb: int | None = 512
    compile_timeout_s: float = 12.0
    extra_env: dict[str, str] = field(default_factory=dict)
    entry_class_from_source: bool = False


def _java_main_class(source: str) -> str:
    """Best-effort main class name for a Java submission."""
    classes = list(re.finditer(r"\b(?:public\s+|final\s+|abstract\s+)*class\s+(\w+)", source))
    if not classes:
        return "Main"
    main_at = re.search(r"static\s+(?:public\s+)?void\s+main\s*\(", source)
    if main_at:
        # The class whose declaration most closely precedes `main`.
        preceding = [m for m in classes if m.start() < main_at.start()]
        if preceding:
            return preceding[-1].group(1)
    public = re.search(r"\bpublic\s+(?:final\s+|abstract\s+)*class\s+(\w+)", source)
    return public.group(1) if public else classes[0].group(1)


def _node_supports_typescript() -> bool:
    """Node >= 22.6 can strip TypeScript types; >= 23.6 does so by default."""
    node = shutil.which("node")
    if not node:
        return False
    try:
        out = subprocess.run(
            [node, "--version"], capture_output=True, text=True, timeout=5
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return False
    match = re.match(r"v(\d+)\.(\d+)", out)
    if not match:
        return False
    major, minor = int(match.group(1)), int(match.group(2))
    return major > 22 or (major == 22 and minor >= 6)


def _ts_run_argv(_workdir: Path, source: Path) -> list[str]:
    node = shutil.which("node") or "node"
    argv = [node]
    try:
        out = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=5).stdout
        major = int(re.match(r"v(\d+)", out.strip()).group(1))  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001 - probing is best-effort
        major = 0
    if major and major < 23:
        argv.append("--experimental-strip-types")
    argv.append(str(source))
    return argv


SPECS: dict[str, LanguageSpec] = {
    "python": LanguageSpec(
        language="python",
        source_name="solution.py",
        compile_argv=None,
        run_argv=lambda _w, src: [sys.executable, "-I", str(src)],
        probe=[sys.executable, "--version"],
        memory_mb=768,
    ),
    "javascript": LanguageSpec(
        language="javascript",
        source_name="solution.js",
        compile_argv=None,
        run_argv=lambda _w, src: [shutil.which("node") or "node", str(src)],
        probe=["node", "--version"],
        memory_mb=None,  # V8 reserves a large virtual heap up front
    ),
    "typescript": LanguageSpec(
        language="typescript",
        source_name="solution.ts",
        compile_argv=None,
        run_argv=_ts_run_argv,
        probe=["node", "--version"],
        memory_mb=None,
    ),
    "c": LanguageSpec(
        language="c",
        source_name="solution.c",
        compile_argv=lambda w, src: [
            shutil.which("cc") or shutil.which("gcc") or "cc",
            "-std=c17", "-O1", "-w", "-o", str(w / "program"), str(src), "-lm",
        ],
        run_argv=lambda w, _src: [str(w / "program")],
        probe=["cc", "--version"],
    ),
    "cpp": LanguageSpec(
        language="cpp",
        source_name="solution.cpp",
        compile_argv=lambda w, src: [
            shutil.which("c++") or shutil.which("g++") or "c++",
            "-std=c++17", "-O1", "-w", "-o", str(w / "program"), str(src),
        ],
        run_argv=lambda w, _src: [str(w / "program")],
        probe=["c++", "--version"],
    ),
    "java": LanguageSpec(
        language="java",
        source_name="Main.java",
        compile_argv=lambda w, src: [shutil.which("javac") or "javac", "-nowarn", "-d", str(w), str(src)],
        run_argv=lambda w, src: [
            shutil.which("java") or "java",
            "-XX:+UseSerialGC", "-Xss16m", "-Xmx256m",
            "-cp", str(w), _java_main_class(src.read_text(encoding="utf-8", errors="replace")),
        ],
        probe=["javac", "-version"],
        memory_mb=None,  # the JVM manages its own heap via -Xmx
        compile_timeout_s=20.0,
        entry_class_from_source=True,
    ),
    "go": LanguageSpec(
        language="go",
        source_name="main.go",
        compile_argv=lambda w, src: [
            shutil.which("go") or "go", "build", "-o", str(w / "program"), str(src)
        ],
        run_argv=lambda w, _src: [str(w / "program")],
        probe=["go", "version"],
        memory_mb=None,
        compile_timeout_s=25.0,
    ),
}


def _probe(spec: LanguageSpec) -> RuntimeInfo:
    argv = list(spec.probe)
    binary = argv[0]
    resolved = binary if os.path.isabs(binary) else shutil.which(binary)
    if not resolved:
        return RuntimeInfo(
            language=spec.language,
            display=display_name(spec.language),
            available=False,
            reason=f"`{binary}` is not installed on the server",
        )
    if spec.language == "typescript" and not _node_supports_typescript():
        return RuntimeInfo(
            language="typescript",
            display="TypeScript",
            available=False,
            executable=resolved,
            reason="Node.js 22.6+ is required to run TypeScript directly",
        )
    try:
        proc = subprocess.run(
            [resolved, *argv[1:]], capture_output=True, text=True, timeout=8
        )
        version = (proc.stdout or proc.stderr or "").strip().splitlines()
        return RuntimeInfo(
            language=spec.language,
            display=display_name(spec.language),
            available=True,
            version=version[0][:120] if version else None,
            executable=resolved,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return RuntimeInfo(
            language=spec.language,
            display=display_name(spec.language),
            available=False,
            executable=resolved,
            reason=f"runtime probe failed: {exc}",
        )


@lru_cache(maxsize=1)
def detect_runtimes() -> dict[str, RuntimeInfo]:
    """Probe every supported toolchain once per process."""
    found = {lang: _probe(spec) for lang, spec in SPECS.items()}
    logger.info(
        "execution.runtimes.detected",
        available=[k for k, v in found.items() if v.available],
        missing=[k for k, v in found.items() if not v.available],
    )
    return found


def get_runtime(language: str) -> RuntimeInfo:
    return detect_runtimes()[normalise_language(language)]


def is_language_executable(language: str) -> bool:
    return get_runtime(language).available


def get_spec(language: str) -> LanguageSpec:
    return SPECS[normalise_language(language)]
