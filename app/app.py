"""
ClearPath - Hugging Face Space entry point.

Outer shell is a Gradio `Blocks` app so HF's `sdk: gradio` Spaces can
detect it; inside, this file boots (and supervises) the Node API,
analysis worker, and dispatcher as child processes on the Space's CPU.

The previous iteration of this file was a bare subprocess supervisor
that never bound `$PORT` through Gradio, so HF's runtime kept the
Space on "Starting ZeroGPU" and printed "No @spaces.GPU function
detected during startup" after its startup-timeout SIGTERM.

Architecture:
  - A module-level `@spaces.GPU(duration=1)` stub satisfies HF's
    ZeroGPU detector. It is never invoked.
  - `npm install` runs in a background thread so HF's readiness probe
    (Gradio binding `$PORT`) is not blocked by network/IO.
  - Once `npm install` completes, the three Node children are spawned
    and supervised in the main thread.
  - A `/health` JSON route (served by Gradio's underlying FastAPI
    app) reports the supervisor + per-service status.

This file must remain import-safe: no top-level work that can block
or raise, and no required env vars.
"""

from __future__ import annotations

import os
import shutil
import signal
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
        self.last_error: Optional[str] = None

    def start(self) -> None:
        cmd = self.cmd_fn()
        if not cmd:
            print(f"[boot] {self.label}: skipped (no command)", flush=True)
            return

        env = self.env_fn()
        try:
            self.proc = _spawn(cmd, self.cwd, self.log_path, env=env)
            self.started_at = time.time()
            self.last_error = None
            print(f"[boot] starting {self.label} (pid={self.proc.pid})", flush=True)
        except Exception as exc:
            self.last_error = repr(exc)
            print(f"[boot] failed to start {self.label}: {exc!r}", flush=True)

    def stop(self) -> None:
        if self.proc is not None:
            _terminate(self.proc, self.label)
            self.proc = None
            self.started_at = None

    def status(self) -> dict:
        alive = self.proc is not None and self.proc.poll() is None
        uptime = None
        if self.started_at is not None and alive:
            uptime = round(time.time() - self.started_at, 1)
        return {
            "label": self.label,
            "pid": self.proc.pid if self.proc else None,
            "alive": alive,
            "uptime_s": uptime,
            "started_at": self.started_at,
            "last_error": self.last_error,
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
# Lifecycle
# ---------------------------------------------------------------------------

_supervisor_started_at = time.time()
_services_started = threading.Event()
_last_install_error: Optional[str] = None


def _install_and_serve() -> None:
    """Install Node deps (if missing) then start the supervised services.

    Runs in a background thread. Started by `main()` AFTER `demo.launch()`
    has returned, so HF's Gradio readiness probe sees a live HTTP server
    even if `npm install` is still in progress.
    """
    global _last_install_error

    if not (BACKEND_DIR / "node_modules").exists():
        print("[boot] running npm install in backend...", flush=True)
        env = os.environ.copy()
        env["NODE_ENV"] = "development"
        try:
            subprocess.run(
                ["npm", "install", "--no-audit", "--no-fund"],
                cwd=str(BACKEND_DIR),
                env=env,
                check=True,
            )
            print("[boot] npm install completed", flush=True)
        except subprocess.CalledProcessError as exc:
            _last_install_error = f"npm install failed with code {exc.returncode}"
            print(f"[boot] {_last_install_error}; children will not start", flush=True)
            return
        except Exception as exc:
            _last_install_error = f"npm install raised {exc!r}"
            print(f"[boot] {_last_install_error}; children will not start", flush=True)
            return

    print("[boot] starting backend services…", flush=True)
    for svc in services:
        svc.start()
        if svc.label == "Fastify":
            time.sleep(1.5)

    print("[boot] all services launched", flush=True)
    _services_started.set()

    # Monitor children for the lifetime of the Space.
    while True:
        try:
            time.sleep(5)
            for svc in services:
                if svc.proc is not None:
                    ret = svc.proc.poll()
                    if ret is not None:
                        tail = _tail_log(svc.log_path, LOG_TAIL_LINES)
                        print(
                            f"[{svc.label}] exited with code {ret} – last {len(tail)} log line(s):",
                            flush=True,
                        )
                        for line in tail:
                            print(f"  {svc.label}> {line}", flush=True)
                        svc.last_error = (
                            f"exited with code {ret}; see {svc.log_path}"
                        )
                        svc.proc = None
                        svc.started_at = None
        except KeyboardInterrupt:
            break


def shutdown_all(*args):  # type: ignore[reportUnusedParameter]
    print("[shutdown] stopping backend services…", flush=True)
    for svc in services:
        svc.stop()
    # Exit so HF's runtime can swap in a new container. Gradio's
    # atexit handlers will run first and shut the demo down cleanly.
    sys.exit(0)


# ---------------------------------------------------------------------------
# Gradio shell
# ---------------------------------------------------------------------------

def _status_text() -> str:
    lines = [
        f"Supervisor uptime: {round(time.time() - _supervisor_started_at, 1)}s",
        f"PORT: {PORT}",
        f"Backend: {BACKEND_DIR}",
        f"Services started: {_services_started.is_set()}",
    ]
    if _last_install_error:
        lines.append(f"!! {_last_install_error}")
    lines.append("")
    for svc in services:
        st = svc.status()
        marker = "🟢" if st["alive"] else ("🟡" if st["pid"] else "⚪")
        lines.append(
            f"{marker} {st['label']}: pid={st['pid']} alive={st['alive']}"
            + (f" uptime={st['uptime_s']}s" if st["uptime_s"] is not None else "")
        )
        if st["last_error"]:
            lines.append(f"     last_error: {st['last_error']}")
    return "\n".join(lines)


def _build_status_payload() -> dict:
    return {
        "status": "ok",
        "uptime_s": round(time.time() - _supervisor_started_at, 1),
        "port": PORT,
        "services_started": _services_started.is_set(),
        "install_error": _last_install_error,
        "services": [svc.status() for svc in services],
    }


def build_demo():
    """Build and return the Gradio `Blocks` app.

    Kept as a function so callers (and tests) can construct the demo
    without `launch()`-ing it. Imports Gradio lazily so that the
    module remains importable on environments that do not have the
    `gradio` package installed (e.g. local backend tests).
    """
    import gradio as gr  # local import – see comment above

    with gr.Blocks(title="ClearPath Backend", theme=gr.themes.Soft()) as demo:
        gr.Markdown(
            "# ClearPath Backend\n"
            "This Hugging Face Space hosts the ClearPath Node backend, "
            "the BullMQ analysis worker, and the outbox dispatcher.\n\n"
            "The Node children are spawned in the background once `npm install` "
            "finishes; the Gradio UI stays live throughout so HF's readiness "
            "probe never starves."
        )
        refresh_btn = gr.Button("Refresh status", variant="primary")
        status_box = gr.Textbox(
            value=_status_text,
            label="Supervisor status",
            lines=20,
            interactive=False,
            every=5,
        )
        refresh_btn.click(fn=_status_text, inputs=None, outputs=status_box)

        # Wire the JSON health route into Gradio's underlying FastAPI
        # app so `/health` (and `/`, `/healthz`) returns the same
        # machine-readable payload that the supervisor uses
        # internally.
        fastapi_app = demo.app
        fastapi_app.add_api_route(
            "/health",
            lambda: _build_status_payload(),
            methods=["GET"],
        )
        fastapi_app.add_api_route(
            "/healthz",
            lambda: _build_status_payload(),
            methods=["GET"],
        )

    return demo


def main():
    signal.signal(signal.SIGTERM, shutdown_all)
    signal.signal(signal.SIGINT, shutdown_all)

    demo = build_demo()

    # Boot Gradio first so HF's readiness probe (Gradio binds $PORT)
    # succeeds even while npm install is still in progress.
    demo.queue().launch(
        server_name="0.0.0.0",
        server_port=PORT,
        prevent_thread_lock=True,
        show_error=True,
    )
    print(f"[boot] Gradio listening on 0.0.0.0:{PORT}", flush=True)

    # Kick off npm install + supervisor in a background thread.
    t = threading.Thread(
        target=_install_and_serve, name="install-and-serve", daemon=True
    )
    t.start()

    # Block the main thread so the HF container stays alive. Gradio
    # is non-blocking because `prevent_thread_lock=True`; we keep this
    # thread parked on an Event until SIGTERM.
    stopper = threading.Event()
    def _term_handler(*_args):  # type: ignore[reportUnusedParameter]
        stopper.set()
        shutdown_all()

    def _int_handler(*_args):  # type: ignore[reportUnusedParameter]
        stopper.set()
        shutdown_all()

    signal.signal(signal.SIGTERM, _term_handler)
    signal.signal(signal.SIGINT, _int_handler)
    stopper.wait()


if __name__ == "__main__":
    main()
