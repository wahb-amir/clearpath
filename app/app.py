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

# NOTE: deliberately NOT using `from __future__ import annotations`
# here. PEP563 postpones all annotations to strings, which FastAPI
# cannot introspect when we add routes to Gradio's underlying FastAPI
# app inside `_install_health_routes`. Without real annotations at
# registration time, FastAPI treats the `request` parameter of the
# health handlers as a query parameter and /health returns 422
# ("Field required: query.request"). Python 3.12 has native PEP 604
# union syntax (X | None), so the future import is unnecessary.

import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional

try:
    import httpx  # type: ignore
except ImportError:
    httpx = None  # type: ignore

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
# The Node API listens on this port internally (Gradio owns the public $PORT).
INTERNAL_API_PORT = int(os.environ.get("INTERNAL_API_PORT", "3001"))
# Paths to proxy from the public Gradio app to the internal Node API.
PROXY_PREFIXES = ("/api", "/auth", "/uploads", "/analysis")
# Hop-by-hop headers that must be stripped per RFC 7230 §6.1.
_HOP_BY_HOP = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host",
})

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

def _spawn(cmd: list[str], cwd: Path, log_path: Path, env: dict | None = None) -> tuple[subprocess.Popen, "object"]:
    """Spawn a supervised child, tee-ing its output to a log file AND stdout.

    On a HF Space the per-child log file lives on ephemeral disk and is
    not viewable from the Space UI – the only log stream operators
    actually see is the Gradio/uvicorn parent process's stdout.
    ``_tee_stdout`` reads each child's combined stdout/stderr line by
    line, writes it to ``log_path`` (so the existing tail-on-crash
    behavior keeps working), and re-emits it on the supervisor's stdout
    so it shows up in HF's main log stream alongside the `[boot] ...`
    supervisor lines.

    Returns ``(proc, log_file)``: ``proc`` is the live Popen, ``log_file``
    is the open append-mode handle to ``log_path`` that the tee writes
    into. Caller owns both and must close ``log_file`` on shutdown.
    """
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "ab", buffering=0)
    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env or os.environ.copy(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        # New process group so we can SIGTERM the whole tree on shutdown.
        preexec_fn=os.setsid if os.name == "posix" else None,
        bufsize=0,
        text=True,
    ), log_file


class _ChildLogTee(threading.Thread):
    """Forward a child's stdout to (a) its log file and (b) the supervisor's stdout.

    Daemon thread so a hung tee never blocks the supervisor from exiting
    on SIGTERM/SIGINT. Each line is prefixed with ``[<label>] `` so a
    HF log reader can tell which service produced it without having to
    correlate timestamps across per-service log files (which, again,
    live on ephemeral disk and are not viewable from the Space UI).
    """

    def __init__(self, proc: subprocess.Popen, log_file, label: str) -> None:
        super().__init__(name=f"tee-{label}", daemon=True)
        self.proc = proc
        self.log_file = log_file
        self.label = label
        self._stopped = threading.Event()

    def run(self) -> None:
        assert self.proc.stdout is not None
        stream = self.proc.stdout
        for raw in stream:
            if not raw:
                # EOF on a text-mode stream: empty trailing line.
                if self._stopped.is_set():
                    return
                continue
            line = raw if raw.endswith("\n") else raw + "\n"
            try:
                self.log_file.write(line)
            except Exception:
                # Log file may have been rotated/removed; never let a
                # logging failure kill the tee thread.
                pass
            try:
                sys.stdout.write(f"[{self.label}] {line}")
                sys.stdout.flush()
            except Exception:
                # stdout may be closed during interpreter shutdown.
                pass
            if self._stopped.is_set() and self.proc.poll() is not None:
                # After we've been asked to stop AND the child has
                # exited, drain any remaining buffered output once.
                remaining = stream.read()
                if remaining:
                    try:
                        self.log_file.write(remaining)
                        sys.stdout.write(f"[{self.label}] {remaining}")
                        sys.stdout.flush()
                    except Exception:
                        pass
                return

    def stop(self) -> None:
        self._stopped.set()


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
        self.log_file = None
        self.tee: Optional["_ChildLogTee"] = None
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
            self.proc, self.log_file = _spawn(cmd, self.cwd, self.log_path, env=env)
            # Tee the child's combined stdout/stderr to the per-service
            # log file AND the supervisor's stdout so it reaches HF's
            # main log stream.
            self.tee = _ChildLogTee(self.proc, self.log_file, self.label)
            self.tee.start()
            self.started_at = time.time()
            self.last_error = None
            print(f"[boot] starting {self.label} (pid={self.proc.pid})", flush=True)
        except Exception as exc:
            self.last_error = repr(exc)
            print(f"[boot] failed to start {self.label}: {exc!r}", flush=True)

    def stop(self) -> None:
        if self.proc is not None:
            _terminate(self.proc, self.label)
            if self.tee is not None:
                # Tell the tee to drain remaining output, then close the
                # pipe so the read() in the tee thread can exit.
                self.tee.stop()
            try:
                if self.proc.stdout is not None:
                    self.proc.stdout.close()
            except Exception:
                pass
            if self.tee is not None:
                self.tee.join(timeout=2)
            if self.log_file is not None:
                try:
                    self.log_file.close()
                except Exception:
                    pass
            self.proc = None
            self.tee = None
            self.log_file = None
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


TSX_BIN = BACKEND_DIR / "node_modules" / ".bin" / "tsx"


def _tsx_cmd(src_file: str) -> list[str]:
    """Return the best command to run a TypeScript source file.

    Prefer the local tsx binary (installed as a devDependency) so we
    don't pay the `npx` resolution overhead and don't rely on the
    network at service start time.
    """
    if TSX_BIN.exists():
        return [str(TSX_BIN), src_file]
    return ["npx", "--yes", "tsx", src_file]


def get_api_cmd():
    if (BACKEND_DIR / "dist" / "index.js").exists():
        return ["node", "dist/index.js"]
    return _tsx_cmd("src/index.ts")

def get_api_env():
    env = os.environ.copy()
    # IMPORTANT: do NOT propagate PORT to the Express/Fastify child. Gradio is
    # the public-facing server on $PORT (default 7860); the Node API
    # runs on an INTERNAL port (default 3001 per .env defaults) and is
    # only reachable from inside the container. Gradio's /health JSON
    # route exposes supervisor status externally; the Node API is internal.
    env.pop("PORT", None)
    env.pop("HOST", None)
    env.setdefault("NODE_ENV", "production")
    return env


def get_worker_cmd():
    if (BACKEND_DIR / "dist" / "workers" / "run.js").exists():
        return ["node", "dist/workers/run.js"]
    return _tsx_cmd("src/workers/run.ts")

def get_worker_env():
    env = os.environ.copy()
    env.setdefault("NODE_ENV", "production")
    return env


def get_dispatcher_cmd():
    if (BACKEND_DIR / "dist" / "outbox" / "run.js").exists():
        return ["node", "dist/outbox/run.js"]
    return _tsx_cmd("src/outbox/run.ts")

def get_dispatcher_env():
    env = os.environ.copy()
    env.setdefault("NODE_ENV", "production")
    return env


def get_ocr_cmd():
    """Return the OCR worker command, or None to skip it.

    Auto-starts the Docling worker if the entry point exists, UNLESS the
    operator has explicitly set ENABLE_PYTHON_OCR_WORKER=0 to disable it.
    Setting ENABLE_PYTHON_OCR_WORKER=1 forces it even if the entry point
    is missing (useful to surface a clearer error message).
    """
    explicit_enable = _truthy(os.environ.get("ENABLE_PYTHON_OCR_WORKER", ""))
    explicit_disable = os.environ.get("ENABLE_PYTHON_OCR_WORKER", "").strip().lower() in {"0", "false", "no", "off"}

    main_py = OCR_DIR / "src" / "main.py"

    if explicit_disable:
        print("[boot] Docling worker: skipped (ENABLE_PYTHON_OCR_WORKER=0)", flush=True)
        return None

    if not explicit_enable and not main_py.exists():
        print(f"[boot] Docling worker: skipped (entry not found at {main_py}; set ENABLE_PYTHON_OCR_WORKER=1 to force)", flush=True)
        return None

    for candidate in (OCR_VENV_PYTHON, OCR_VENV_PYTHON3):
        if candidate.exists():
            python = str(candidate)
            break
    else:
        python = shutil.which("python3") or shutil.which("python")

    if not python:
        print("[boot] Docling worker: skipped (no python interpreter found)", flush=True)
        return None

    if not main_py.exists():
        print(f"[boot] Docling worker: skipped (entry not found at {main_py})", flush=True)
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
    """Install Node deps (if missing), build TypeScript, then start supervised services.

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

    # Build the TypeScript dist so we can run `node dist/index.js` instead of tsx.
    # This is faster at runtime and avoids needing npx to resolve the tsx binary.
    if not (BACKEND_DIR / "dist" / "index.js").exists():
        print("[boot] building TypeScript dist...", flush=True)
        try:
            subprocess.run(
                ["npm", "run", "build"],
                cwd=str(BACKEND_DIR),
                check=True,
            )
            print("[boot] TypeScript build completed", flush=True)
        except subprocess.CalledProcessError as exc:
            print(f"[boot] TypeScript build failed with code {exc.returncode}; will fall back to tsx", flush=True)
        except Exception as exc:
            print(f"[boot] TypeScript build raised {exc!r}; will fall back to tsx", flush=True)

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

    with gr.Blocks(title="ClearPath Backend") as demo:
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

        # NOTE: do NOT add the /health routes here. In Gradio 6.x,
        # `demo.app` is a placeholder App object at construction time;
        # the live uvicorn-served FastAPI app is only assigned to
        # `demo.app` after `demo.launch()` returns. Adding routes
        # here mounts them on the placeholder, which is never served,
        # so /health would be matched by Gradio's catch-all and
        # return HTML. The post-launch hook is in `main()`.

    return demo


def _launch_kwargs() -> dict:
    """Build the kwargs passed to `demo.launch()`.

    Kept separate so the `gr` import stays scoped to `build_demo()` –
    Pylance can resolve `gr` and we don't need a top-level `gradio`
    import (which would break local dev environments that don't have
    the package installed).
    """
    import gradio as gr

    return {
        "server_name": "0.0.0.0",
        "server_port": PORT,
        "theme": gr.themes.Soft(),
        "prevent_thread_lock": True,
        "show_error": True,
        # Re-enable Gradio's strict CORS so Gradio's permissive-CORS
        # middleware does NOT echo `Access-Control-Allow-Origin: <attacker>`
        # back to arbitrary origins on OPTIONS preflight for our
        # proxied /api /auth /uploads /analysis routes. We install our
        # own CORSMiddleware scoped to those prefixes (see
        # `_install_cors_middleware`) which sets the
        # Access-Control-Allow-Credentials header and restricts the
        # origin to the allowlist returned by `_cors_allowed_origins`.
        "strict_cors": True,
        # Force off SSR mode. In Gradio 6.x SSR mode, the PUBLIC $PORT is
        # served by a bundled Node.js process, not by Python's uvicorn –
        # Python only listens internally (e.g. :7861). That Node process
        # forwards requests to Python using a hardcoded prefix allowlist
        # (see gradio/templates/node/build/proxy_routes.js:
        # PYTHON_ROUTE_PREFIXES = ["/gradio_api", "/config", "/login",
        # "/logout", "/theme.css", "/robots.txt", "/pwa_icon",
        # "/manifest.json", "/monitoring"]). Anything outside that list –
        # including our own /health, /healthz, /api/*, /auth/*,
        # /uploads/*, /analysis/* routes mounted on demo.app – never
        # reaches Python at all; the Node layer falls through to
        # SvelteKit's SPA fallback and serves index.html (HTML) instead
        # of our JSON. Explicitly disabling SSR here (rather than relying
        # on GRADIO_SSR_MODE being unset, or on the undocumented
        # GRADIO_SERVER_MODE_ENABLED escape hatch) makes Python's uvicorn
        # serve $PORT directly, so every route we install on demo.app is
        # reachable.
        "ssr_mode": False,
    }


def _install_health_routes(demo) -> None:
    """Mount JSON /health and /healthz on the live FastAPI app.

    Called AFTER `demo.launch()` returns, so `demo.app` is the
    uvicorn-served FastAPI app rather than the construction-time
    placeholder. The routes are PREPENDED to Gradio's route list so
    they win over Gradio's catch-all (`/`) regardless of registration
    order quirks in different Gradio versions.

    CORS: Gradio 6.x sets `strict_cors=True` by default, which blocks
    cross-origin browser requests to its routes. The health route is
    expected to be polled by external monitoring (k8s probes, the
    ClearPath frontend at clearpath.buttnetworks.com, etc.), so we
    set permissive CORS headers on the responses directly (no need
    for CORSMiddleware - we only have two routes to expose).
    """
    # IMPORTANT: `Request` MUST be imported here (not inside the handler
    # bodies). FastAPI introspects handler annotations at registration
    # time to distinguish Request objects from query parameters. A
    # lazy `from fastapi import Request` inside the nested function
    # leaves the annotation as a bare string ("Request") and FastAPI
    # then tries to validate `request` as a query parameter – the
    # /health endpoint returns 422 with "Field required: query.request".
    from fastapi import Request
    from fastapi.responses import JSONResponse

    fastapi_app = demo.app

    async def _health_handler(request: Request):
        body = _build_status_payload()
        # Restrict CORS to the same allowlist as the proxied routes.
        # Returning ACAO: * would still let an attacker's browser read
        # the JSON body (no credentials are sent, so it isn't a real
        # leak, but echoing arbitrary origins is still the wrong
        # default and confusing when debugging).
        origin = request.headers.get("origin")
        cors_headers = _cors_headers_for(origin)
        return JSONResponse(
            content=body,
            headers={
                **cors_headers,
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "no-store",
                "Vary": "Origin",
            },
        )

    async def _options_handler(request: Request):
        origin = request.headers.get("origin")
        cors_headers = _cors_headers_for(origin)
        return JSONResponse(
            content=None,
            status_code=204 if cors_headers else 403,
            headers={
                **cors_headers,
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin",
            },
        )

    # Register the routes on the live app, then prepend them to the
    # router's route list so they match BEFORE Gradio's catch-all at
    # `/`. add_api_route appends; FastAPI/Starlette match in order.
    health_routes = []
    for path in ("/health", "/healthz"):
        # NOTE: `add_api_route()` returns None — it appends the Route to
        # `fastapi_app.routes` internally rather than returning it. Grab
        # the just-appended route from the route list instead of using
        # the (None) return value, or we end up inserting `None` into
        # `router.routes`, which crashes every request with
        # "'NoneType' object has no attribute 'matches'".
        fastapi_app.add_api_route(
            path,
            _health_handler,
            methods=["GET"],
        )
        health_routes.append(fastapi_app.routes[-1])
        fastapi_app.add_api_route(
            path,
            _options_handler,
            methods=["OPTIONS"],
        )
        health_routes.append(fastapi_app.routes[-1])

    # Move the four routes to the front of the list. Starlette/FastAPI
    # match in registration order; Gradio's catch-all is at index 0
    # of the route list after launch(), so prepending guarantees our
    # routes win on /health and /healthz regardless of any future
    # Gradio route registration changes.
    existing = list(fastapi_app.router.routes)
    fastapi_app.router.routes = health_routes + [
        r for r in existing if r not in health_routes
    ]


def _cors_allowed_origins() -> frozenset[str]:
    """Origins allowed to make credentialed cross-origin requests to the
    proxied /api, /auth, /uploads, /analysis routes.

    Mirrors the allowlist in app/backend/src/index.ts's cors() config so
    the two layers agree. Kept here (rather than only trusting whatever
    Express/Gradio decide) because we've observed the preflight response
    for these routes coming back with NO
    Access-Control-Allow-Credentials header at all -- which two
    independent implicit CORS layers (Gradio's own CustomCORSMiddleware,
    which always sets it, and Express's cors() package, credentials:true)
    should both prevent, yet the browser reported it missing. Rather than
    keep chasing which of two layers silently swallowed it on a given
    request, we own the whole CORS contract for these routes directly at
    the one choke point every one of these requests must cross: our
    reverse proxy.

    The production frontend is https://clearpath.buttnetworks.com/ --
    always in the allowlist. FRONTEND_URL env var (when set) is added
    on top so a deploy that hasn't cut over DNS yet still works.
    Localhost dev origins are also accepted by default; they can be
    disabled by setting ``STRICT_CORS=1`` in the Space's env.
    """
    origins = {
        "https://wahb-ai-clearpath-backend.hf.space",
        "https://huggingface.co",
        # Production frontend. Always allowed.
        "https://clearpath.buttnetworks.com",
    }
    if not _truthy(os.environ.get("STRICT_CORS")):
        # Local dev origins. Useful for hitting the deployed backend
        # from a local Next.js dev server. Setting STRICT_CORS=1
        # disables this escape hatch for production deployments.
        origins.update({
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        })
    frontend_url = os.environ.get("FRONTEND_URL")
    if frontend_url:
        origins.add(frontend_url.rstrip("/"))
    return frozenset(origins)


def _cors_headers_for(origin: str | None) -> dict[str, str]:
    """Return the CORS response headers for ``origin``.

    Returns an empty dict for unknown origins -- callers must NOT add
    any permissive default themselves. Returning ``{}`` causes the
    preflight handler to send a 204 with no
    ``Access-Control-Allow-*`` headers, which causes the browser to
    block the follow-up request (the secure default).
    """
    if not origin or origin not in _cors_allowed_origins():
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


def _install_proxy_routes(demo) -> None:
    """Mount async reverse-proxy routes on Gradio's live FastAPI app.

    Forwards /api/*, /auth/*, /uploads/*, /analysis/* to the internal
    Node API on INTERNAL_API_PORT. This is necessary because HF's Gradio
    SDK owns $PORT; Gradio is the public-facing server and the Node API
    runs internally.

    SSE streams (Content-Type: text/event-stream) are forwarded using
    httpx's streaming API so they are never buffered.

    CORS preflight (OPTIONS) requests are answered directly here, and
    never forwarded upstream -- see `_cors_headers_for` for why. Actual
    requests also get these headers force-set on the response, on top
    of (overwriting, not merely trusting) whatever Express returned, so
    a credentialed cross-origin request from an allowed origin always
    gets a correct, consistent answer regardless of what either Gradio's
    or Express's own CORS layer independently decided to do.
    """
    if httpx is None:
        print("[boot] httpx not available – API proxy not installed", flush=True)
        return

    from fastapi import Request
    from fastapi.responses import Response, StreamingResponse

    fastapi_app = demo.app
    base_url = f"http://127.0.0.1:{INTERNAL_API_PORT}"

    async def _proxy_handler(request: Request, path: str = "") -> Response:
        origin = request.headers.get("origin")
        cors_headers = _cors_headers_for(origin)

        # Answer CORS preflight deterministically, in Python, and never
        # forward it upstream. See the module docstring above / the
        # comment on `_cors_allowed_origins` for why we don't delegate
        # this to Gradio's or Express's own CORS handling.
        if (
            request.method == "OPTIONS"
            and "access-control-request-method" in request.headers
        ):
            if not cors_headers:
                # Origin not recognized – return 403 with no CORS
                # headers so the browser refuses the follow-up request.
                # Using 403 (not 204) makes it clear to anyone probing
                # the endpoint that this origin is not on the
                # allowlist, and a 204 with no headers would still let
                # a permissive browser tolerate the response.
                return Response(status_code=403, headers={"Vary": "Origin"})
            requested_headers = request.headers.get(
                "access-control-request-headers"
            )
            return Response(
                status_code=204,
                headers={
                    **cors_headers,
                    "Access-Control-Allow-Methods": (
                        "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
                    ),
                    "Access-Control-Allow-Headers": requested_headers or "*",
                    "Access-Control-Max-Age": "600",
                },
            )

        prefix = "/" + request.url.path.lstrip("/").split("/")[0]
        upstream_path = request.url.path
        upstream = f"{base_url}{upstream_path}"
        if request.url.query:
            upstream += f"?{request.url.query}"

        headers = {
            k: v for k, v in request.headers.items()
            if k.lower() not in _HOP_BY_HOP
        }
        body = await request.body()

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=10.0)
        ) as client:
            try:
                upstream_resp = await client.request(
                    method=request.method,
                    url=upstream,
                    headers=headers,
                    content=body,
                )
            except httpx.RequestError as exc:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    {"error": "upstream_unreachable", "detail": str(exc)},
                    status_code=502,
                    headers=cors_headers,
                )

        resp_headers = {
            k: v for k, v in upstream_resp.headers.items()
            if k.lower() not in _HOP_BY_HOP
        }
        # Strip any Access-Control-* headers the upstream Node API set,
        # then force-set our own on top. Without the strip, an unknown
        # origin would still see Express's echoed
        # Access-Control-Allow-Origin in the response (we don't want
        # to leak that to attackers). For known origins we overwrite
        # anyway so Access-Control-Allow-Credentials: true is
        # guaranteed -- Express's cors() config sometimes drops it
        # for credentialed preflights depending on how the headers
        # line up.
        resp_headers = {
            k: v for k, v in resp_headers.items()
            if not k.lower().startswith("access-control-")
        }
        resp_headers.update(cors_headers)
        content_type = upstream_resp.headers.get("content-type", "")

        # Stream SSE responses without buffering.
        if "text/event-stream" in content_type:
            async def _stream():
                async for chunk in upstream_resp.aiter_bytes():
                    yield chunk
            return StreamingResponse(
                _stream(),
                status_code=upstream_resp.status_code,
                headers=resp_headers,
                media_type=content_type,
            )

        return Response(
            content=upstream_resp.content,
            status_code=upstream_resp.status_code,
            headers=resp_headers,
            media_type=content_type,
        )

    proxy_routes = []
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
    for prefix in PROXY_PREFIXES:
        # NOTE: `add_api_route()` returns None (see _install_health_routes
        # above for why) — read back the appended route object instead.
        fastapi_app.add_api_route(
            f"{prefix}/{{path:path}}", _proxy_handler, methods=methods
        )
        proxy_routes.append(fastapi_app.routes[-1])
        fastapi_app.add_api_route(
            prefix, _proxy_handler, methods=methods
        )
        proxy_routes.append(fastapi_app.routes[-1])

    # Prepend so proxy routes match before Gradio's catch-all.
    existing = list(fastapi_app.router.routes)
    fastapi_app.router.routes = proxy_routes + [
        r for r in existing if r not in proxy_routes
    ]
    print(f"[boot] proxy routes installed for {PROXY_PREFIXES}", flush=True)



def main():
    signal.signal(signal.SIGTERM, shutdown_all)
    signal.signal(signal.SIGINT, shutdown_all)

    demo = build_demo()

    # Boot Gradio first so HF's readiness probe (Gradio binds $PORT)
    # succeeds even while npm install is still in progress.
    demo.queue().launch(**_launch_kwargs())
    # In Gradio 6.x `launch()` returns (app, local_url, share_url);
    # the live FastAPI app is also reassigned to `demo.app` post-launch.
    print(f"[boot] Gradio listening on 0.0.0.0:{PORT}", flush=True)

    # Mount /health, /healthz and reverse-proxy routes on the live app.
    _install_health_routes(demo)
    _install_proxy_routes(demo)

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
