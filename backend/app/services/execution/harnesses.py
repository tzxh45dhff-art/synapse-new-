"""Test harnesses injected alongside user code for function-mode grading.

Each harness reads a JSON spec (entry point + test cases), calls the user's
function once per case, and writes structured results to a file. Results go to
a *file*, never stdout, so anything the user prints stays cleanly separated
from the verdict — printing the expected answer can no longer look like a pass.

Results are rewritten after every case, so a submission that hangs still tells
us exactly which case it hung on.
"""

from __future__ import annotations

# ── Python ────────────────────────────────────────────────────────────────────

PYTHON_HARNESS = r'''
import contextlib
import copy
import io
import json
import math
import os
import sys
import time
import traceback

SPEC_PATH = os.environ["BUNKER_SPEC"]
RESULT_PATH = os.environ["BUNKER_RESULT"]
SOURCE_PATH = os.environ["BUNKER_SOURCE"]

with open(SPEC_PATH, "r", encoding="utf-8") as fh:
    SPEC = json.load(fh)

RESULTS = []
STATE = {"fatal": None, "fatal_kind": None, "setup_stdout": ""}


def emit():
    payload = {
        "results": RESULTS,
        "fatal": STATE["fatal"],
        "fatal_kind": STATE["fatal_kind"],
        "setup_stdout": STATE["setup_stdout"],
    }
    tmp = RESULT_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, default=str)
    os.replace(tmp, RESULT_PATH)


def finish(kind, message):
    STATE["fatal"] = message
    STATE["fatal_kind"] = kind
    emit()
    sys.exit(0)


# ── Deny outbound network from user code ────────────────────────────────────
try:
    import socket

    def _blocked(*_a, **_k):
        raise OSError("Network access is disabled inside the grader sandbox.")

    socket.socket = _blocked
    socket.create_connection = _blocked
    socket.create_server = _blocked
except Exception:
    pass


# ── Value normalisation + comparison ────────────────────────────────────────

def normalise(value):
    if isinstance(value, tuple):
        return [normalise(v) for v in value]
    if isinstance(value, list):
        return [normalise(v) for v in value]
    if isinstance(value, (set, frozenset)):
        try:
            return sorted(normalise(v) for v in value)
        except TypeError:
            return sorted((repr(v) for v in value))
    if isinstance(value, dict):
        return {str(k): normalise(v) for k, v in value.items()}
    if isinstance(value, bool):
        return value
    if isinstance(value, complex):
        return [value.real, value.imag]
    if hasattr(value, "tolist"):
        try:
            return normalise(value.tolist())
        except Exception:
            pass
    return value


def sort_deep(value):
    if isinstance(value, list):
        inner = [sort_deep(v) for v in value]
        try:
            return sorted(inner, key=lambda v: json.dumps(v, sort_keys=True, default=str))
        except Exception:
            return inner
    return value


def equal(actual, expected, mode, tol):
    if isinstance(actual, bool) != isinstance(expected, bool):
        # Guard Python's bool-is-int equality: True must not satisfy `1`.
        if isinstance(actual, bool) or isinstance(expected, bool):
            return False
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        if isinstance(actual, float) or isinstance(expected, float) or mode == "float":
            return math.isclose(float(actual), float(expected), rel_tol=tol, abs_tol=tol)
        return actual == expected
    if isinstance(actual, str) and isinstance(expected, str):
        if mode == "exact":
            return actual == expected
        if mode == "ignore_case":
            return actual.strip().lower() == expected.strip().lower()
        return actual.strip() == expected.strip()
    if isinstance(actual, list) and isinstance(expected, list):
        left, right = (sort_deep(actual), sort_deep(expected)) if mode == "unordered" else (actual, expected)
        if len(left) != len(right):
            return False
        return all(equal(a, b, mode, tol) for a, b in zip(left, right))
    if isinstance(actual, dict) and isinstance(expected, dict):
        if set(actual.keys()) != set(expected.keys()):
            return False
        return all(equal(actual[k], expected[k], mode, tol) for k in actual)
    if actual == expected:
        return True
    # Last resort: the model often serialises the expected value as a string.
    try:
        return json.dumps(actual, sort_keys=True, default=str) == json.dumps(
            expected, sort_keys=True, default=str
        )
    except Exception:
        return str(actual).strip() == str(expected).strip()


def render(value, limit=2000):
    try:
        text = json.dumps(value, default=repr, ensure_ascii=False)
    except Exception:
        text = repr(value)
    return text if len(text) <= limit else text[:limit] + " …"


# ── Load the submission ──────────────────────────────────────────────────────

import importlib.util  # noqa: E402

module = None
setup_buffer = io.StringIO()
try:
    loader_spec = importlib.util.spec_from_file_location("__submission__", SOURCE_PATH)
    module = importlib.util.module_from_spec(loader_spec)
    sys.modules["__submission__"] = module
    with contextlib.redirect_stdout(setup_buffer), contextlib.redirect_stderr(setup_buffer):
        loader_spec.loader.exec_module(module)
except SyntaxError as exc:
    STATE["setup_stdout"] = setup_buffer.getvalue()
    finish("compile", "SyntaxError: %s (line %s)" % (exc.msg, exc.lineno))
except SystemExit:
    STATE["setup_stdout"] = setup_buffer.getvalue()
except BaseException:
    STATE["setup_stdout"] = setup_buffer.getvalue()
    finish("runtime", traceback.format_exc(limit=6))

STATE["setup_stdout"] = setup_buffer.getvalue()


# ── Resolve the entry point ──────────────────────────────────────────────────

def resolve_entry(name):
    target = getattr(module, name, None) if name else None
    if callable(target) and not isinstance(target, type):
        return target, None

    # LeetCode-style: a `Solution` class holding the method.
    for cls_name in ("Solution", "solution"):
        cls = getattr(module, cls_name, None)
        if isinstance(cls, type):
            method = getattr(cls, name, None) if name else None
            if callable(method):
                return getattr(cls(), name), None
            methods = [
                m for m in dir(cls)
                if not m.startswith("_") and callable(getattr(cls, m, None))
            ]
            if len(methods) == 1:
                return getattr(cls(), methods[0]), None

    if isinstance(target, type):
        try:
            return target(), None
        except Exception:
            pass

    own = [
        (key, value)
        for key, value in vars(module).items()
        if callable(value)
        and not key.startswith("_")
        and getattr(value, "__module__", None) == "__submission__"
        and not isinstance(value, type)
    ]
    if len(own) == 1:
        return own[0][1], None
    if name and own:
        lowered = name.lower()
        for key, value in own:
            if key.lower() == lowered:
                return value, None
    if name:
        available = ", ".join(sorted(k for k, _ in own)) or "none"
        return None, (
            "Your code does not define a function named `%s`. "
            "Functions found: %s. Keep the function name from the starter code."
            % (name, available)
        )
    return None, "Could not find a function to test in your submission."


entry_name = SPEC.get("entry_point")
func, entry_error = resolve_entry(entry_name)
if func is None:
    finish("entry", entry_error)


# ── Run the cases ────────────────────────────────────────────────────────────

mode = SPEC.get("comparison", "trim")
tol = float(SPEC.get("float_tolerance", 1e-6))

for index, case in enumerate(SPEC.get("tests", [])):
    args = copy.deepcopy(case.get("args") or [])
    kwargs = copy.deepcopy(case.get("kwargs") or {})
    buffer = io.StringIO()
    record = {
        "index": index,
        "passed": False,
        "actual": None,
        "actual_value": None,
        "stdout": "",
        "error": None,
        "duration_ms": 0,
    }
    started = time.perf_counter()
    try:
        with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
            if case.get("stdin") is not None:
                sys.stdin = io.StringIO(case["stdin"])
            returned = func(*args, **kwargs)
        record["duration_ms"] = int((time.perf_counter() - started) * 1000)
        printed = buffer.getvalue()
        record["stdout"] = printed[:4000]

        expected_stdout = case.get("expected_stdout")
        has_expected_value = "expected" in case and case.get("expected") is not None
        normalised = normalise(returned)
        record["actual"] = render(normalised)
        try:
            json.dumps(normalised)
            record["actual_value"] = normalised
        except (TypeError, ValueError):
            record["actual_value"] = None

        checks = []
        if has_expected_value:
            checks.append(equal(normalised, normalise(case.get("expected")), mode, tol))
        if expected_stdout is not None:
            checks.append(
                "\n".join(line.rstrip() for line in printed.strip().splitlines())
                == "\n".join(line.rstrip() for line in str(expected_stdout).strip().splitlines())
            )
        if not checks:
            # Nothing asserted: treat "ran without raising" as the bar.
            checks.append(True)
        record["passed"] = all(checks)
    except SystemExit:
        record["duration_ms"] = int((time.perf_counter() - started) * 1000)
        record["stdout"] = buffer.getvalue()[:4000]
        record["error"] = "Your code called sys.exit() during the test."
    except RecursionError:
        record["duration_ms"] = int((time.perf_counter() - started) * 1000)
        record["stdout"] = buffer.getvalue()[:4000]
        record["error"] = "RecursionError: maximum recursion depth exceeded."
    except BaseException:
        record["duration_ms"] = int((time.perf_counter() - started) * 1000)
        record["stdout"] = buffer.getvalue()[:4000]
        trace = traceback.format_exc(limit=4)
        record["error"] = trace[-1200:]
    finally:
        sys.stdin = sys.__stdin__

    RESULTS.append(record)
    emit()

emit()
'''


# ── JavaScript / TypeScript ───────────────────────────────────────────────────
# Appended after the user's source so top-level declarations stay in scope.

JS_HARNESS_SUFFIX = r'''

/* ===== grader harness (appended automatically) ===== */
;(async function __bunkerHarness__() {
  const __fs = require("fs");
  const __specPath = process.env.BUNKER_SPEC;
  const __resultPath = process.env.BUNKER_RESULT;
  const __spec = JSON.parse(__fs.readFileSync(__specPath, "utf8"));
  const __results = [];
  const __state = { fatal: null, fatal_kind: null, setup_stdout: "" };

  const __emit = () => {
    __fs.writeFileSync(
      __resultPath + ".tmp",
      JSON.stringify({
        results: __results,
        fatal: __state.fatal,
        fatal_kind: __state.fatal_kind,
        setup_stdout: __state.setup_stdout,
      })
    );
    __fs.renameSync(__resultPath + ".tmp", __resultPath);
  };

  const __finish = (kind, message) => {
    __state.fatal_kind = kind;
    __state.fatal = message;
    __emit();
    process.exit(0);
  };

  // Capture anything the submission prints, per test case.
  let __capture = null;
  const __realWrite = process.stdout.write.bind(process.stdout);
  const __realErrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, enc, cb) => {
    if (__capture !== null) { __capture.push(String(chunk)); if (cb) cb(); return true; }
    return __realWrite(chunk, enc, cb);
  };
  process.stderr.write = (chunk, enc, cb) => {
    if (__capture !== null) { __capture.push(String(chunk)); if (cb) cb(); return true; }
    return __realErrWrite(chunk, enc, cb);
  };

  const __normalise = (value) => {
    if (value instanceof Set) return Array.from(value).map(__normalise).sort();
    if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()));
    if (Array.isArray(value)) return value.map(__normalise);
    if (value && typeof value === "object") {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = __normalise(value[key]);
      return out;
    }
    if (typeof value === "undefined") return null;
    if (typeof value === "bigint") return Number(value);
    return value;
  };

  const __stable = (v) => JSON.stringify(v);
  const __sortDeep = (v) =>
    Array.isArray(v) ? v.map(__sortDeep).sort((a, b) => (__stable(a) < __stable(b) ? -1 : 1)) : v;

  const __equal = (actual, expected, mode, tol) => {
    if (typeof actual === "number" && typeof expected === "number") {
      if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
      return Math.abs(actual - expected) <= Math.max(tol, tol * Math.abs(expected));
    }
    if (typeof actual === "string" && typeof expected === "string") {
      if (mode === "exact") return actual === expected;
      if (mode === "ignore_case") return actual.trim().toLowerCase() === expected.trim().toLowerCase();
      return actual.trim() === expected.trim();
    }
    if (Array.isArray(actual) && Array.isArray(expected)) {
      const [l, r] = mode === "unordered" ? [__sortDeep(actual), __sortDeep(expected)] : [actual, expected];
      return l.length === r.length && l.every((v, i) => __equal(v, r[i], mode, tol));
    }
    if (actual && expected && typeof actual === "object" && typeof expected === "object") {
      const ka = Object.keys(actual).sort();
      const kb = Object.keys(expected).sort();
      if (__stable(ka) !== __stable(kb)) return false;
      return ka.every((k) => __equal(actual[k], expected[k], mode, tol));
    }
    if (actual === expected) return true;
    return __stable(actual) === __stable(expected) || String(actual).trim() === String(expected).trim();
  };

  const __render = (value) => {
    let text;
    try { text = JSON.stringify(value); } catch (_e) { text = String(value); }
    if (typeof text === "undefined") text = String(value);
    return text.length > 2000 ? text.slice(0, 2000) + " …" : text;
  };

  // Resolve the entry point from the enclosing script scope.
  const __entryName = __spec.entry_point;
  let __fn;
  const __candidates = [];
  if (__entryName) {
    try { __fn = eval(__entryName); } catch (_e) { __fn = undefined; }
    if (typeof __fn !== "function" && typeof globalThis[__entryName] === "function") {
      __fn = globalThis[__entryName];
    }
    if (typeof __fn !== "function" && typeof module !== "undefined" && module.exports) {
      const exported = module.exports;
      if (typeof exported === "function") __fn = exported;
      else if (exported && typeof exported[__entryName] === "function") __fn = exported[__entryName];
    }
  }
  if (typeof __fn !== "function") {
    if (typeof module !== "undefined" && module.exports) {
      for (const key of Object.keys(module.exports)) {
        if (typeof module.exports[key] === "function") __candidates.push(key);
      }
      if (__candidates.length === 1) __fn = module.exports[__candidates[0]];
    }
  }
  if (typeof __fn !== "function") {
    __finish(
      "entry",
      "Your code does not define a function named `" + __entryName + "`. " +
        "Keep the function name from the starter code."
    );
  }

  const __mode = __spec.comparison || "trim";
  const __tol = Number(__spec.float_tolerance ?? 1e-6);
  const __tests = __spec.tests || [];

  for (let i = 0; i < __tests.length; i += 1) {
    const testCase = __tests[i];
    const args = JSON.parse(JSON.stringify(testCase.args || []));
    const record = { index: i, passed: false, actual: null, actual_value: null, stdout: "", error: null, duration_ms: 0 };
    const started = Date.now();
    __capture = [];
    try {
      let returned = __fn(...args);
      if (returned && typeof returned.then === "function") returned = await returned;
      record.duration_ms = Date.now() - started;
      const printed = __capture.join("");
      record.stdout = printed.slice(0, 4000);
      const normalised = __normalise(returned);
      record.actual = __render(normalised);
      try { JSON.stringify(normalised); record.actual_value = normalised; } catch (_e) { record.actual_value = null; }

      const checks = [];
      if (Object.prototype.hasOwnProperty.call(testCase, "expected") && testCase.expected !== null) {
        checks.push(__equal(normalised, __normalise(testCase.expected), __mode, __tol));
      }
      if (testCase.expected_stdout !== null && testCase.expected_stdout !== undefined) {
        const clean = (s) => String(s).trim().split("\n").map((l) => l.replace(/\s+$/, "")).join("\n");
        checks.push(clean(printed) === clean(testCase.expected_stdout));
      }
      if (checks.length === 0) checks.push(true);
      record.passed = checks.every(Boolean);
    } catch (err) {
      record.duration_ms = Date.now() - started;
      record.stdout = __capture.join("").slice(0, 4000);
      record.error = String((err && err.stack) || err).slice(0, 1200);
    } finally {
      __capture = null;
    }
    __results.push(record);
    __emit();
  }

  __emit();
  process.exit(0);
})().catch((err) => {
  try {
    require("fs").writeFileSync(
      process.env.BUNKER_RESULT,
      JSON.stringify({ results: [], fatal: String((err && err.stack) || err), fatal_kind: "runtime", setup_stdout: "" })
    );
  } catch (_e) { /* nothing else we can do */ }
  process.exit(0);
});
'''
