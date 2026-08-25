"""
ClearPath – Hugging Face Space entry point.

This file is what HF Spaces runs on a ZeroGPU space. It exposes a Gradio
UI that:

  1. Lazily boots the Node Express API in a child process (no GPU).
  2. Lazily boots the Python OCR / Docling worker **on demand**, gated
     by the ``@spaces.GPU`` decorator so the GPU is only allocated
     while a real OCR job is running. This keeps the space inside the
     ZeroGPU free-quota by avoiding a permanent GPU reservation.
  3. Shows live status for both services and exposes a minimal
     health-check / file-upload form so the rest of the stack can be
     exercised from the Space without needing the local frontend.

Nothing in this file assumes a local Redis. The REDIS_URL env var is
read from the Space secrets and threaded into the spawned backend
process; the backend already prefers REDIS_URL when present.
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

import gradio as gr

# ---------------------------------------------------------------------------
# Paths & runtime configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"
OCR_DIR = BACKEND_DIR / "services" / "ocr-engine"
PORT = int(os.environ.get("PORT", "7860"))


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


# ---------------------------------------------------------------------------
# Express API process
# ---------------------------------------------------------------------------

class ApiProcess:
    """Manages the Node Express server. Restartable from the Gradio UI."""

    def __init__(self) -> None:
        self.proc: Optional[subprocess.Popen] = None
        self.log_path = REPO_ROOT / "logs" / "api.log"

    def is_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def start(self) -> str:
        if self.is_running():
            return f"API already running (pid={self.proc.pid})."

        if not BACKEND_ENV_FILE.exists():
            return (
                f"❌ Missing {BACKEND_ENV_FILE}. Add Supabase + Redis secrets "
                "to the Space's environment variables and restart."
            )

        # Prefer `npm run start` so the production build path is taken
        # (matches the Dockerfile). Falls back to `tsx` for dev Spaces.
        cmd = ["npm", "run", "start"] if (BACKEND_DIR / "dist" / "index.js").exists() \
            else ["npx", "tsx", "src/index.ts"]

        self.proc = _spawn(cmd, BACKEND_DIR, self.log_path)
        # Give the server a moment to bind before reporting back.
        time.sleep(2.0)
        return f"✅ API started (pid={self.proc.pid}). Tail: {self.log_path}"

    def stop(self) -> str:
        if not self.is_running():
            return "API is not running."
        try:
            os.killpg(self.proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        self.proc.wait(timeout=10)
        self.proc = None
        return "🛑 API stopped."

    def status(self) -> str:
        running = self.is_running()
        last_log = ""
        if self.log_path.exists():
            try:
                last_log = "\n".join(self.log_path.read_text(errors="ignore").splitlines()[-15:])
            except Exception:
                last_log = "(unable to read log)"
        state = "🟢 running" if running else "🔴 stopped"
        return f"API: {state} (pid={getattr(self.proc, 'pid', '-')})\n\n--- tail ---\n{last_log}"


api = ApiProcess()


# ---------------------------------------------------------------------------
# Gradio UI
# ---------------------------------------------------------------------------

CUSTOM_CSS = """
.gradio-container { max-width: 920px !important; }
.footer { display:none }
"""


def boot_api() -> str:
    return api.start()


def stop_api() -> str:
    return api.stop()


def api_status() -> str:
    return api.status()


def healthcheck() -> str:
    """Hits the Express /api/health route over localhost."""
    import urllib.request
    import urllib.error
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=3) as r:
            return f"✅ {r.status} – {r.read().decode()}"
    except urllib.error.URLError as e:
        return f"❌ {e.reason}"
    except Exception as e:
        return f"❌ {e}"


def run_ocr_on_upload(file_path: str | None) -> str:
    """
    OCR path – allocated on the ZeroGPU. Decorated lazily so the GPU
    is *not* held while the user is just reading the docs or pinging
    the health endpoint. Each call is a fresh allocation.
    """
    if not file_path:
        return "⚠️ Please upload a PDF / image first."

    # Lazy import + @spaces.GPU decoration (HF helper).
    try:
        import spaces  # type: ignore
    except Exception:
        spaces = None

    if spaces is not None:
        @spaces.GPU(duration=120)
        def _ocr_with_gpu() -> str:
            return _run_docling_ocr(file_path)
        return _ocr_with_gpu()
    return _run_docling_ocr(file_path)


def _run_docling_ocr(file_path: str) -> str:
    """Pure-CPU path. Used when @spaces.GPU is unavailable (e.g. dev)."""
    try:
        from docling.document_converter import DocumentConverter  # type: ignore
    except Exception as e:
        return (
            "❌ Docling is not installed in this Space. Add it to "
            "the Space's requirements and rebuild.\n"
            f"({e})"
        )
    converter = DocumentConverter()
    res = converter.convert(file_path)
    md = res.document.export_to_markdown()
    # Truncate to keep the Gradio Textbox responsive.
    return md[:20000] + ("\n\n…(truncated)" if len(md) > 20000 else "")


with gr.Blocks(title="ClearPath – HF Space", css=CUSTOM_CSS) as demo:
    gr.Markdown(
        """
        # 🛡️ ClearPath – Document Triage on ZeroGPU

        This Space runs the ClearPath backend (Express API) and exposes a
        thin Gradio front-end so the GPU is only allocated when an actual
        OCR job is requested.

        **Tips to stay inside the ZeroGPU free quota**
        - Don't spam the *Run OCR* button – each click allocates a fresh GPU.
        - Use the *Health* tab to verify the API is up without spending GPU seconds.
        - All long-lived workers are off by default; turn the API on only when
          you need to push a document through the full pipeline.
        """
    )

    with gr.Tab("Service controls"):
        with gr.Row():
            boot_btn = gr.Button("▶ Start API", variant="primary")
            stop_btn = gr.Button("⏹ Stop API", variant="stop")
            refresh_btn = gr.Button("🔄 Refresh status")
        api_state = gr.Textbox(label="Service status", lines=18, interactive=False)

        boot_btn.click(boot_api, outputs=api_state)
        stop_btn.click(stop_api, outputs=api_state)
        refresh_btn.click(api_status, outputs=api_state)

    with gr.Tab("Health"):
        hc_btn = gr.Button("Ping /api/health")
        hc_out = gr.Textbox(label="Result", interactive=False)
        hc_btn.click(healthcheck, outputs=hc_out)

    with gr.Tab("OCR (GPU)"):
        gr.Markdown(
            "Upload a PDF or image. Each run is a fresh ZeroGPU allocation "
            "and will count against your quota."
        )
        upload = gr.File(label="Document", type="filepath")
        ocr_btn = gr.Button("Run OCR", variant="primary")
        ocr_out = gr.Textbox(label="Markdown output", lines=20, interactive=False)
        ocr_btn.click(run_ocr_on_upload, inputs=upload, outputs=ocr_out)


def _shutdown(*_: object) -> None:
    if api.is_running():
        api.stop()


# Make sure the API child is reaped on Space shutdown.
signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)


if __name__ == "__main__":
    # HF Spaces require `demo.launch(server_name="0.0.0.0", server_port=PORT)`.
    demo.queue(max_size=8).launch(
        server_name="0.0.0.0",
        server_port=PORT,
        show_error=True,
        prevent_thread_lock=True,
    )
    # Keep the parent process alive so signal handlers can clean up the
    # child API process when HF shuts the Space down.
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        _shutdown()
