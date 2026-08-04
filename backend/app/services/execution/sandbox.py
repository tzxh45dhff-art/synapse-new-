"""Low-level sandboxed process runner.

Every user process is started in its own session (so the whole tree can be
killed on timeout), inside a throwaway working directory, with a stripped
environment and POSIX resource limits applied in the child before exec.

This is defence in depth, not a container. The strongest guarantees are the
wall-clock timeout, the CPU limit and the output cap — those hold everywhere.
Memory/process limits are applied where the platform supports them.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import signal
import sys
import tempfile
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator, Sequence

import structlog

logger = structlog.get_logger()

# Hard ceilings. Individual calls may request less, never more.
MAX_TIMEOUT_S = 15.0
MAX_OUTPUT_BYTES = 256 * 1024  # 256 KB of stdout/stderr per process
DEFAULT_MEMORY_MB = 512
DEFAULT_FILE_SIZE_MB = 32
# RLIMIT_NPROC counts every process owned by the UID, not just this tree, so a
# busy host makes toolchains fail to fork. Left off by default; the wall-clock
# timeout plus RLIMIT_CPU are what actually bound a runaway submission.
DEFAULT_MAX_PROCESSES: int | None = None

_IS_POSIX = os.name == "posix"

try:  # pragma: no cover - platform dependent
    import resource
except ImportError:  # pragma: no cover - Windows
    resource = None  # type: ignore[assignment]


@dataclass(slots=True)
class ProcessResult:
    """Outcome of a single sandboxed process."""

    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    timed_out: bool = False
    truncated: bool = False
    signal_name: str | None = None

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


def _truncate(raw: bytes) -> tuple[str, bool]:
    """Decode process output, capping runaway printers."""
    truncated = len(raw) > MAX_OUTPUT_BYTES
    if truncated:
        raw = raw[:MAX_OUTPUT_BYTES]
    text = raw.decode("utf-8", errors="replace")
    if truncated:
        text += "\n… output truncated (limit 256 KB) …"
    return text, truncated


def _build_env(workdir: Path, extra: dict[str, str] | None) -> dict[str, str]:
    """Minimal environment: enough to run a toolchain, nothing more."""
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(workdir),
        "TMPDIR": str(workdir),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
        "NODE_OPTIONS": "",
        "NO_COLOR": "1",
    }
    # Toolchains that genuinely need a few host variables.
    for key in ("JAVA_HOME", "GOROOT", "GOPATH", "GOCACHE", "SDKROOT", "SYSTEMROOT"):
        value = os.environ.get(key)
        if value:
            env[key] = value
    if extra:
        env.update(extra)
    return env


def _limits_preexec(
    memory_mb: int | None,
    cpu_seconds: int,
    max_processes: int | None,
    file_size_mb: int,
):
    """Build the child-side callback that applies rlimits before exec."""

    def _apply() -> None:  # pragma: no cover - runs in the forked child
        os.setsid()
        if resource is None:
            return
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
        except (ValueError, OSError):
            pass
        try:
            size = file_size_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_FSIZE, (size, size))
        except (ValueError, OSError):
            pass
        try:
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        except (ValueError, OSError):
            pass
        if max_processes is not None:
            try:
                resource.setrlimit(resource.RLIMIT_NPROC, (max_processes, max_processes))
            except (ValueError, OSError):
                pass
        if memory_mb is not None:
            size = memory_mb * 1024 * 1024
            for limit_name in ("RLIMIT_AS", "RLIMIT_DATA"):
                limit = getattr(resource, limit_name, None)
                if limit is None:
                    continue
                try:
                    resource.setrlimit(limit, (size, size))
                except (ValueError, OSError):
                    pass

    return _apply


@asynccontextmanager
async def workspace(prefix: str = "bunker-exec-") -> AsyncIterator[Path]:
    """A throwaway directory that is always removed, even on cancellation."""
    path = Path(tempfile.mkdtemp(prefix=prefix))
    try:
        yield path
    finally:
        await asyncio.to_thread(shutil.rmtree, path, True)


async def run_process(
    argv: Sequence[str],
    *,
    cwd: Path,
    stdin: str | None = None,
    timeout_s: float = 5.0,
    memory_mb: int | None = DEFAULT_MEMORY_MB,
    max_processes: int | None = DEFAULT_MAX_PROCESSES,
    file_size_mb: int = DEFAULT_FILE_SIZE_MB,
    env: dict[str, str] | None = None,
) -> ProcessResult:
    """Run ``argv`` under the sandbox and return its captured result.

    Never raises for user-code failures — a crash, a timeout or a compiler
    error all come back as a populated :class:`ProcessResult`.
    """
    timeout_s = max(0.5, min(timeout_s, MAX_TIMEOUT_S))
    cpu_seconds = max(1, int(timeout_s) + 1)

    kwargs: dict[str, object] = {}
    if _IS_POSIX:
        kwargs["preexec_fn"] = _limits_preexec(
            memory_mb, cpu_seconds, max_processes, file_size_mb
        )
    if sys.platform == "win32":  # pragma: no cover - not a deploy target
        kwargs["creationflags"] = 0x00000200  # CREATE_NEW_PROCESS_GROUP

    started = time.perf_counter()
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            cwd=str(cwd),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=_build_env(cwd, env),
            **kwargs,  # type: ignore[arg-type]
        )
    except (FileNotFoundError, PermissionError, OSError) as exc:
        return ProcessResult(
            exit_code=127,
            stdout="",
            stderr=f"Failed to start runtime: {exc}",
            duration_ms=0,
        )

    timed_out = False
    try:
        raw_out, raw_err = await asyncio.wait_for(
            proc.communicate(stdin.encode() if stdin is not None else None),
            timeout=timeout_s,
        )
    except asyncio.TimeoutError:
        timed_out = True
        _kill_tree(proc)
        try:
            raw_out, raw_err = await asyncio.wait_for(proc.communicate(), timeout=2.0)
        except (asyncio.TimeoutError, ValueError):
            raw_out, raw_err = b"", b""
    except (BrokenPipeError, ConnectionResetError):
        raw_out, raw_err = b"", b"Process closed its input stream unexpectedly."

    duration_ms = int((time.perf_counter() - started) * 1000)
    stdout, cut_out = _truncate(raw_out or b"")
    stderr, cut_err = _truncate(raw_err or b"")

    exit_code = proc.returncode if proc.returncode is not None else -1
    signal_name: str | None = None
    if exit_code < 0:
        try:
            signal_name = signal.Signals(-exit_code).name
        except (ValueError, AttributeError):
            signal_name = f"signal {-exit_code}"

    return ProcessResult(
        exit_code=exit_code,
        stdout=stdout,
        stderr=stderr,
        duration_ms=duration_ms,
        timed_out=timed_out,
        truncated=cut_out or cut_err,
        signal_name=signal_name,
    )


def _kill_tree(proc: asyncio.subprocess.Process) -> None:
    """SIGKILL the child's whole process group; fall back to the child alone."""
    if proc.returncode is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        return
    except (ProcessLookupError, PermissionError, AttributeError, OSError):
        pass
    try:
        proc.kill()
    except ProcessLookupError:
        pass


def write_file(directory: Path, name: str, content: str) -> Path:
    """Write a source file into the workspace and return its path."""
    path = directory / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path
