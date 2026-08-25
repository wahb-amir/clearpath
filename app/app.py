"""
ClearPath - Hugging Face Space entry point.

Single-process orchestrator for the whole ClearPath stack on a ZeroGPU
Space. Boots (and supervises) every backend service without any proxy
or UI.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
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

PORT = os.environ.get("PORT", "7860")

def _truthy(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}

ENABLE_PYTHON_OCR_WORKER = _truthy(os.environ.get("ENABLE_PYTHON_OCR_WORKER"))

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

    def start(self) -> None:
        cmd = self.cmd_fn()
        if not cmd:
            print(f"[boot] {self.label}: skipped (no command)", flush=True)
            return
        
        env = self.env_fn()
        self.proc = _spawn(cmd, self.cwd, self.log_path, env=env)
        print(f"[boot] starting {self.label} (pid={self.proc.pid})", flush=True)

    def stop(self) -> None:
        if self.proc is not None:
            _terminate(self.proc, self.label)
            self.proc = None

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

def shutdown_all(*args):
    print("[shutdown] stopping backend services…", flush=True)
    for svc in services:
        svc.stop()
    sys.exit(0)

def main():
    signal.signal(signal.SIGTERM, shutdown_all)
    signal.signal(signal.SIGINT, shutdown_all)

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
                        print(f"[{svc.label}] exited with code {ret}", flush=True)
                        svc.proc = None
        except KeyboardInterrupt:
            shutdown_all()

if __name__ == "__main__":
    main()
