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

OCR accelerator selection
-------------------------
The OCR tab can run on either the ZeroGPU A10G or on plain CPU. On a
free-tier Space the GPU has a tight monthly quota, so CPU is the safe
default. Users can opt in to the GPU per-run via a checkbox.

Behaviour is controlled by the ``OCR_USE_GPU`` env var:

* ``"0"``, ``"false"``, ``"no"`` (default) – CPU path is used. The
  ``@spaces.GPU`` decorator is not applied, so a request never
  allocates GPU time. The Gradio handler still calls the same
  ``_run_docling_ocr`` function, which loads docling on CPU.
* ``"1"``, ``"true"``, ``"yes"`` – GPU path is used. ``ocr_on_gpu`` is
  decorated with ``@spaces.GPU(duration=120)`` at module scope so HF's
  startup detector finds it.

Per-run override: the OCR tab has an "Use GPU (faster, burns quota)"
checkbox that swaps between the two module-level functions. The GPU
function is always defined at module load time so the detector is
happy regardless of the default.
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
# spaces.GPU — must be imported and applied at module load time so HF
# Spaces' startup detector can find a decorated function. Defining it
# lazily (inside a handler) is too late: HF's container emits
# "No @spaces.GPU function detected during startup" before the first
# request ever lands.
# ---------------------------------------------------------------------------
try:
    import spaces  # type: ignore
except Exception:  # pragma: no cover - dev / non-HF environments
    spaces = None

# ---------------------------------------------------------------------------
# Paths & runtime configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
BACKEND_ENV_FILE = BACKEND_DIR / ".env"
OCR_DIR = BACKEND_DIR / "services" / "ocr-engine"
PORT = int(os.environ.get("PORT", "7860"))


def _truthy(value: str | None) -> bool:
    """Parse common truthy string spellings used in env vars."""
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


# Default to CPU so the free-tier Space doesn't burn GPU quota on
# every uploaded document. Set OCR_USE_GPU=1 in the Space's env vars
# (or tick the checkbox in the OCR tab) to allocate the A10G.
OCR_USE_GPU_DEFAULT = _truthy(os.environ.get("OCR_USE_GPU"))


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


def run_ocr_on_upload(file_path: str | None, use_gpu: bool | None = None) -> str:
    """
    Gradio handler. Validates the upload and dispatches to either the
    module-level ``ocr_on_gpu`` (GPU) or ``ocr_on_cpu`` (CPU) function.

    Both functions are defined at module scope so HF Spaces' startup
    detector can find a @spaces.GPU-decorated function even when the
    user prefers the default CPU path. The ``use_gpu`` checkbox lets
    the user opt in per-run without restarting the Space.
    """
    if not file_path:
        return "⚠️ Please upload a PDF / image first."
    if use_gpu is None:
        use_gpu = OCR_USE_GPU_DEFAULT
    if use_gpu:
        return ocr_on_gpu(file_path)
    return ocr_on_cpu(file_path)


# Module-level @spaces.GPU function so the HF Spaces startup
# detector can find it. The closure captures ``spaces`` from the
# import above; if ``spaces`` is None (dev / non-HF), we still
# expose a plain function so the handler works locally.
if spaces is not None:
    @spaces.GPU(duration=120)
    def ocr_on_gpu(file_path: str) -> str:
        return _run_docling_ocr(file_path, accelerator="gpu")
else:  # pragma: no cover - dev / non-HF environments
    def ocr_on_gpu(file_path: str) -> str:
        return _run_docling_ocr(file_path, accelerator="gpu")


def ocr_on_cpu(file_path: str) -> str:
    """Module-level CPU entry point. No GPU allocation, no quota burn."""
    return _run_docling_ocr(file_path, accelerator="cpu")


def _run_docling_ocr(file_path: str, accelerator: str = "cpu") -> str:
    """
    Run Docling on either CPU or the allocated GPU.

    On CPU we force docling's pipeline to use ``AcceleratorOptions`` with
    ``device="cpu"`` so it never accidentally touches a CUDA device that
    might be missing on a CPU-only Space. On GPU we let docling's
    auto-detected defaults (it will pick cuda when available) do the
    right thing, capped by the ZeroGPU ``duration=120`` quota.
    """
    try:
        from docling.datamodel.accelerator_options import AcceleratorOptions  # type: ignore
        from docling.document_converter import DocumentConverter  # type: ignore
    except Exception as e:
        return (
            "❌ Docling is not installed in this Space. Add it to "
            "the Space's requirements and rebuild.\n"
            f"({e})"
        )

    # Force the device explicitly so a CPU-only container never tries
    # to touch CUDA. On GPU we pass device="auto" to let docling
    # negotiate with whatever HF handed us for the duration window.
    if accelerator == "cpu":
        opts = AcceleratorOptions(device="cpu", num_threads=int(os.environ.get("OCR_THREADS", "2")))
    else:
        opts = AcceleratorOptions(device="auto")

    converter = DocumentConverter(accelerator_options=opts)
    res = converter.convert(file_path)
    md = res.document.export_to_markdown()
    header = f"_Run on {accelerator.upper()} • {len(md):,} chars_\n\n"
    # Truncate to keep the Gradio Textbox responsive.
    truncated = "\n\n…(truncated)" if len(md) > 20000 else ""
    return header + md[:20000] + truncated


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

    with gr.Tab("OCR"):
        gr.Markdown(
            "Upload a PDF or image. **CPU is the default** so the free-tier "
            "ZeroGPU quota isn't burned. Tick the box below to opt in to the "
            "GPU for a single run; each GPU run allocates the A10G for up to "
            "120 seconds and counts against your monthly quota."
        )
        upload = gr.File(label="Document", type="filepath")
        use_gpu = gr.Checkbox(
            label="Use GPU (faster, burns ZeroGPU quota)",
            value=OCR_USE_GPU_DEFAULT,
        )
        ocr_btn = gr.Button("Run OCR", variant="primary")
        ocr_out = gr.Textbox(label="Markdown output", lines=20, interactive=False)
        ocr_btn.click(run_ocr_on_upload, inputs=[upload, use_gpu], outputs=ocr_out)


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
