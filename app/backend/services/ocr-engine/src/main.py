import asyncio
import signal
import tempfile
from bullmq import Worker
from supabase import create_client, Client
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions, OcrEngine
from bullmq_config import (
    get_bullmq_job_name,
    get_bullmq_queue_name,
    get_worker_options,
    should_process_job,
)
from config import settings

SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
QUEUE_NAME = get_bullmq_queue_name()
EXPECTED_JOB_NAME = get_bullmq_job_name()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize Docling once at service startup (pre-loads ONNX models)
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = True
pipeline_options.do_table_structure = True
pipeline_options.ocr_engine = OcrEngine.RAPIDOCR
pipeline_options.images_scale = 2.0

converter = DocumentConverter(
    format_options={"pdf": PdfFormatOption(pipeline_options=pipeline_options)}
)

async def process_ocr_job(job, job_token):
    if not should_process_job(job.name, EXPECTED_JOB_NAME):
        print(f"[OCR Worker] Skipping job {job.id} with name {job.name}")
        return {"status": "skipped", "reason": "job_name_mismatch"}

    storage_path = job.data.get("storagePath")
    job_id = job.id

    print(f"[OCR Worker] Processing job {job_id} for path: {storage_path}")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp_file:
        # 1. Download file from Supabase 'raw-documents' bucket
        file_bytes = supabase.storage.from_("raw-documents").download(storage_path)
        tmp_file.write(file_bytes)
        tmp_file.flush()

        # 2. Run Docling OCR & Layout parsing
        result = converter.convert(tmp_file.name)
        markdown_text = result.document.export_to_markdown()

        # 3. Upload Markdown to 'parsed-documents' bucket
        output_path = f"parsed/{job_id}.md"
        supabase.storage.from_("parsed-documents").upload(
            path=output_path,
            file=markdown_text.encode("utf-8"),
            file_options={"content-type": "text/markdown; charset=utf-8"}
        )

        return {
            "status": "completed",
            "markdownStoragePath": output_path,
            "charCount": len(markdown_text)
        }

async def main():
    # Target the exact queue name used by Fastify producer
    worker = Worker(
        QUEUE_NAME,
        process_ocr_job,
        get_worker_options(),
    )
    print(f"🚀 Python Docling OCR Worker is running and listening to '{QUEUE_NAME}'...")

    shutdown_event = asyncio.Event()
    def handle_signal():
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_signal)

    await shutdown_event.wait()
    await worker.close()

if __name__ == "__main__":
    asyncio.run(main())
