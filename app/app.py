"""
ClearPath - Hugging Face Space entry point.

Single-process orchestrator for the whole ClearPath stack on a ZeroGPU
Space. Boots (and supervises) every backend service without any proxy
or UI, and exposes a tiny HTTP health endpoint on $PORT so HF's
readiness probe can take the Space off "Starting ZeroGPU".
"""

from __future__ import annotations

import http.server
import json
import os
import shutil
import signal
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# spaces.GPU – imported at module load so HF's startup detector finds the
# @spaces.GPU-decorated function.
# ---------------------------------------------------------------------------
try:
    import spaces  # type: ignore
except Exception:  # pragma: no cover - dev / non-HF environments
    spaces = None

# Dummy function for ZeroGPU detection. Never called.
if spaces is not None:
    @spaces.GPU(duration=1)
    def _zerogpu_detection_stub():
        return None


# ---------------------------------------------------------------------------
# Paths & runtime configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
OCR_DIR = BACKEND_DIR / "services" / "ocr-engine"
OCR_VENV_PYTHON = OCR_DIR / "venv" / "bin" / "python"
OCR_VENV_PYTHON3 = OCR_DIR / "venv" / "bin" / "python3"
LOGS_DIR = REPO_ROOT / "logs"

PORT = int(os.environ.get("PORT", "7860"))

def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}

ENABLE_PYTHON_OCR_WORKER = _truthy(os.environ.get("ENABLE_PYTHON_OCR_WORKER"))

# How many trailing lines of a child's log file to print on crash so
# the actual error reaches HF's main log stream (the per-child log file
# lives on ephemeral disk and is not viewable from the Space UI).
LOG_TAIL_LINES = 50


# ---------------------------------------------------------------------------
# Subprocess helpers
# ---------------------------------------------------------------------------

def _spawn(cmd: list[str], cwd: Path, log_path: Path, env: dict | None = None) -> subprocess.Popen:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "ab")
    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env or os.environ.copy(),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        # New process group so we can SIGTERM the whole tree on shutdown.
        preexec_fn=os.setsid if os.name == "posix" else None,
    )


def _terminate(proc: Optional[subprocess.Popen], label: str) -> None:
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        print(f"[{label}] did not exit on SIGTERM; sending SIGKILL", flush=True)
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def _tail_log(path: Path, lines: int) -> list[str]:
    """Return the last `lines` of `path` without loading the whole file."""
    try:
        # Read from the end using a sliding window of `lines` line endings.
        block_size = 4096
        file_size = path.stat().st_size
        if file_size == 0:
            return []
        data = bytearray()
        with path.open("rb") as fh:
            pos = file_size
            while pos > 0 and data.count(b"\n") <= lines:
                read_size = min(block_size, pos)
                pos -= read_size
                fh.seek(pos)
                data = bytearray(fh.read(read_size)) + data
                if pos == 0:
                    break
        text = data.decode("utf-8", errors="replace")
        return text.splitlines()[-lines:]
    except FileNotFoundError:
        return []
    except Exception as exc:  # pragma: no cover - defensive
        return [f"<failed to read log: {exc!r}>"]


# ---------------------------------------------------------------------------
# Service definitions
# ---------------------------------------------------------------------------

class Service:
    def __init__(self, label: str, cmd_fn, cwd: Path, env_fn):
        self.label = label
        self.cmd_fn = cmd_fn
        self.cwd = cwd
        self.env_fn = env_fn
        self.proc: Optional[subprocess.Popen] = None
        self.log_path: Path = LOGS_DIR / f"{self.label}.log"
        self.started_at: Optional[float] = None

    def start(self) -> None:
        cmd = self.cmd_fn()
        if not cmd:
            print(f"[boot] {self.label}: skipped (no command)", flush=True)
            return

        env = self.env_fn()
        self.proc = _spawn(cmd, self.cwd, self.log_path, env=env)
        self.started_at = time.time()
        print(f"[boot] starting {self.label} (pid={self.proc.pid})", flush=True)

    def stop(self) -> None:
        if self.proc is not None:
            _terminate(self.proc, self.label)
            self.proc = None
            self.started_at = None

    def status(self) -> dict:
        alive = self.proc is not None and self.proc.poll() is None
        uptime = None
        if self.started_at is not None:
            uptime = round(time.time() - self.started_at, 1)
        return {
            "label": self.label,
            "pid": self.proc.pid if self.proc else None,
            "alive": alive,
            "uptime_s": uptime,
            "started_at": self.started_at,
        }

def get_api_cmd():
    return (
        ["npm", "run", "start"]
        if (BACKEND_DIR / "dist" / "index.js").exists()
        else ["npx", "tsx", "src/index.ts"]
    )

def get_api_env():
    env = os.environ.copy()
    env["PORT"] = str(PORT)
    env["HOST"] = "0.0.0.0"
    env.setdefault("NODE_ENV", "production")
    return env


def get_worker_cmd():
    return (
        ["npm", "run", "start:worker"]
        if (BACKEND_DIR / "dist" / "workers" / "run.js").exists()
        else ["npx", "tsx", "src/workers/run.ts"]
    )

def get_worker_env():
    env = os.environ.copy()
    env.setdefault("NODE_ENV", "production")
    return env


def get_dispatcher_cmd():
    return (
        ["npm", "run", "start:dispatcher"]
        if (BACKEND_DIR / "dist" / "outbox" / "run.js").exists()
        else ["npx", "tsx", "src/outbox/run.ts"]
    )

def get_dispatcher_env():
    env = os.environ.copy()
    env.setdefault("NODE_ENV", "production")
    return env


def get_ocr_cmd():
    if not ENABLE_PYTHON_OCR_WORKER:
        return None

    for candidate in (OCR_VENV_PYTHON, OCR_VENV_PYTHON3):
        if candidate.exists():
            python = str(candidate)
            break
    else:
        python = shutil.which("python3") or shutil.which("python")

    if not python:
        print("[boot] No python interpreter found for the OCR worker.", flush=True)
        return None

    main_py = OCR_DIR / "src" / "main.py"
    if not main_py.exists():
        print(f"[boot] OCR worker entry not found at {main_py}", flush=True)
        return None

    return [python, str(main_py)]

def get_ocr_env():
    env = os.environ.copy()
    # Threading caps – keeps the OCR worker from chewing the container's CPU budget
    env.setdefault("OMP_NUM_THREADS", "2")
    env.setdefault("OPENBLAS_NUM_THREADS", "2")
    env.setdefault("MKL_NUM_THREADS", "2")

    if env.get("SUPABASE_SECRET_KEY") and not env.get("SUPABASE_KEY"):
        env["SUPABASE_KEY"] = env["SUPABASE_SECRET_KEY"]
    return env

services = [
    Service("Fastify", get_api_cmd, BACKEND_DIR, get_api_env),
    Service("analysis worker", get_worker_cmd, BACKEND_DIR, get_worker_env),
    Service("dispatcher", get_dispatcher_cmd, BACKEND_DIR, get_dispatcher_env),
    Service("Docling worker", get_ocr_cmd, OCR_DIR, get_ocr_env),
]


# ---------------------------------------------------------------------------
# Health server – bound to $PORT so HF's ZeroGPU probe can take the
# Space off "Starting". Stdlib only so we don't pull a new dependency.
# ---------------------------------------------------------------------------

class _HealthHandler(http.server.BaseHTTPRequestHandler):
    # Quiet the default request log; the supervisor already prints
    # boot progress. Set to True while debugging.
    def log_message(self, format, *args):  # noqa: A002,A003 - stdlib signature
        return

    def do_GET(self):  # noqa: N802 - stdlib signature
        if self.path not in ("/", "/health", "/healthz"):
            self.send_response(404)
            self.end_headers()
            return
        payload = {
            "status": "ok",
            "uptime_s": round(time.time() - _supervisor_started_at, 1),
            "services": [svc.status() for svc in services],
        }
        body = json.dumps(payload, indent=2).encode("utf-8")
        # 200 even if every child is dead – the supervisor itself is
        # alive and that is what HF's probe is asking about. Operators
        # can inspect `services[].alive` for per-child health.
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _start_health_server() -> Optional[http.server.ThreadingHTTPServer]:
    """Start the health HTTP server in a background thread. Returns
    the server object so the supervisor can shut it down on exit."""

    bind = ("0.0.0.0", PORT)

    class _ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    try:
        server = _ThreadedServer(bind, _HealthHandler)
    except OSError as exc:
        print(
            f"[health] could not bind to {bind[0]}:{bind[1]} – {exc!r}",
            flush=True,
        )
        return None

    thread = threading.Thread(target=server.serve_forever, name="health", daemon=True)
    thread.start()
    print(f"[health] listening on {bind[0]}:{bind[1]}", flush=True)
    return server


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

def shutdown_all(*args):  # type: ignore[reportUnusedParameter]
    print("[shutdown] stopping backend services…", flush=True)
    for svc in services:
        svc.stop()
    sys.exit(0)


_supervisor_started_at = time.time()
_health_server: Optional[http.server.ThreadingHTTPServer] = None


def main():
    global _health_server

    signal.signal(signal.SIGTERM, shutdown_all)
    signal.signal(signal.SIGINT, shutdown_all)

    # Bind the health server BEFORE spawning children so HF's probe
    # never sees an unbound port. The server runs in a daemon thread.
    _health_server = _start_health_server()

    # In HF spaces, node dependencies might not be pre-installed by the python builder.
    if not (BACKEND_DIR / "node_modules").exists():
        print("[boot] running npm install in backend...", flush=True)
        # We need devDependencies because we run via tsx in the Space since dist/ is not built
        env = os.environ.copy()
        env["NODE_ENV"] = "development"
        try:
            subprocess.run(
                ["npm", "install", "--no-audit", "--no-fund"],
                cwd=str(BACKEND_DIR),
                env=env,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            # Fail fast – the children cannot start without node_modules
            # and silently swallowing the error leaves the operator
            # staring at three "exited with code 1" lines with no clue.
            print(
                f"[boot] npm install failed with code {exc.returncode}; aborting supervisor",
                flush=True,
            )
            sys.exit(1)

    print("[boot] starting backend services…", flush=True)
    for svc in services:
        svc.start()
        # Sleep briefly between starts if it is fastify to give it time to bind
        if svc.label == "Fastify":
            time.sleep(1.5)

    print("[boot] all services launched", flush=True)

    # Keep supervisor alive and monitor children
    while True:
        try:
            time.sleep(5)
            for svc in services:
                if svc.proc is not None:
                    ret = svc.proc.poll()
                    if ret is not None:
                        # Tail the child's log file into the main log
                        # stream so the actual error is visible.
                        tail = _tail_log(svc.log_path, LOG_TAIL_LINES)
                        print(
                            f"[{svc.label}] exited with code {ret} – last {len(tail)} log line(s):",
                            flush=True,
                        )
                        for line in tail:
                            print(f"  {svc.label}> {line}", flush=True)
                        svc.proc = None
                        svc.started_at = None
        except KeyboardInterrupt:
            shutdown_all()


if __name__ == "__main__":
    main()
