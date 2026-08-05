import argparse
import asyncio
from pathlib import Path
import signal
import tempfile

from bullmq import Worker
from supabase import create_client, Client
from docling.document_converter import (
    DocumentConverter, 
    PdfFormatOption, 
    ImageFormatOption
)
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
from bullmq_config import (
    get_bullmq_job_name,
    get_bullmq_queue_name,
    get_worker_options,
    assert_should_process_job,
)
from config import settings

SUPABASE_URL = settings.SUPABASE_URL
SUPABASE_KEY = settings.SUPABASE_KEY
QUEUE_NAME = get_bullmq_queue_name()
EXPECTED_JOB_NAME = get_bullmq_job_name()
WORKER_ID = "ocr-engine"

supabase: Client = create_client(str(SUPABASE_URL), SUPABASE_KEY)

# Initialize Docling once at service startup (pre-loads ONNX models)
pipeline_options = PdfPipelineOptions()
pipeline_options.do_ocr = True
pipeline_options.do_table_structure = True
pipeline_options.ocr_options = RapidOcrOptions()
pipeline_options.images_scale = 2.0

converter = DocumentConverter(
    format_options={
        "pdf": PdfFormatOption(pipeline_options=pipeline_options),
        # Apply the same OCR pipeline options directly to raw images
        "image": ImageFormatOption(pipeline_options=pipeline_options) 
    }
)



def warmup_docling_models():
    """Converts a valid minimal PDF at startup to force-load ONNX and layout models into RAM."""
    print("⏳ Pre-loading Docling OCR and Layout models into memory...")
    
    # Minimal 1-page valid PDF byte stream
    minimal_pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kinds [] /Count 1 /Kids [3 0 R]>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources <<>>>> endobj\n"
        b"xref\n"
        b"0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000052 00000 n \n"
        b"0000000118 00000 n \n"
        b"trailer <</Size 4 /Root 1 0 R>>\n"
        b"startxref\n"
        b"202\n"
        b"%%EOF\n"
    )

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
            tmp.write(minimal_pdf_bytes)
            tmp.flush()
            
            # Execute convert once to force weight loading on startup
            _ = converter.convert(tmp.name)
            
        print("✅ Docling OCR & Layout models loaded successfully!")
    except Exception as e:
        print(f"⚠️ Warmup failed with error: {e}")
        
# Map incoming MIME types to correct file extensions for Docling's parser
MIME_TO_EXTENSION = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/csv": ".csv",
    "text/html": ".html",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}


def process_local_file(file_path: str, output_path: str | None = None) -> None:
    """Processes a local file directly using Docling and saves the output to a .md file."""
    input_path = Path(file_path)

    if not input_path.exists():
        print(f"❌ Error: File standard path '{file_path}' does not exist.")
        return

    if output_path:
        destination_path = Path(output_path)
    else:
        destination_path = input_path.with_suffix(".md")

    print(f"📄 Processing local file: {input_path}")
    result = converter.convert(str(input_path))
    markdown_text = result.document.export_to_markdown()

    destination_path.write_text(markdown_text, encoding="utf-8")
    print(f"✅ Successfully extracted {len(markdown_text)} characters and saved to '{destination_path}'")


def _report_extracting(document_id: str) -> None:
    supabase.table("documents").update(
        {"analysis_status": "EXTRACTING", "current_stage": "EXTRACTING", "worker_id": WORKER_ID}
    ).eq("id", document_id).eq("analysis_status", "PROCESSING").execute()


def _insert_pipeline_event(document_id: str, user_id: str, message: str) -> None:
    supabase.table("document_pipeline_events").insert(
        {
            "document_id": document_id,
            "user_id": user_id,
            "event_type": "extraction_completed",
            "stage": "EXTRACTING",
            "message": message,
            "progress": 30,
        }
    ).execute()


def _write_outbox_extracted(
    analysis_request_id: str,
    document_id: str,
    user_id: str,
    storage_path: str,
    mime_type: str,
    analysis_version: str,
    markdown_storage_path: str,
    ocr_confidence: float,
    text_coverage: float,
) -> None:
    supabase.table("document_pipeline_outbox").insert(
        {
            "event_type": "document.extracted",
            "aggregate_type": "document_analysis_request",
            "aggregate_id": analysis_request_id,
            "status": "pending",
            "payload": {
                "documentId": document_id,
                "analysisRequestId": analysis_request_id,
                "userId": user_id,
                "storagePath": storage_path,
                "mimeType": mime_type,
                "analysisVersion": analysis_version,
                "markdownStoragePath": markdown_storage_path,
                "ocrConfidence": ocr_confidence,
                "textCoverage": text_coverage,
            },
        }
    ).execute()


def _process_job_sync(job_id: str, job_name: str, job_data: dict):
    assert_should_process_job(job_name, EXPECTED_JOB_NAME)

    document_id = job_data.get("documentId")
    user_id = job_data.get("userId")
    analysis_request_id = job_data.get("analysisRequestId")
    storage_path = job_data.get("storagePath")
    mime_type = job_data.get("mimeType", "")
    analysis_version = job_data.get("analysisVersion")

    print(f"[OCR Worker] Processing job {job_id} for path: {storage_path} ({mime_type})")

    try:
        _report_extracting(document_id)

        # 1. Download file bytes from Supabase Storage
        file_bytes = supabase.storage.from_(settings.RAW_BUCKET).download(storage_path)

        # 2. FAST PATH: Plain text & Markdown files bypass Docling heavy ML processing entirely
        if mime_type in ["text/plain", "text/markdown"] or storage_path.endswith((".txt", ".md")):
            print(f"⚡ Fast-pathing plain text extraction for {storage_path}")
            markdown_text = file_bytes.decode("utf-8", errors="replace")
        else:
            # Heavy Path: PDF, Images, DOCX, XLSX via Docling
            file_extension = MIME_TO_EXTENSION.get(mime_type, ".bin")
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=True) as tmp_file:
                tmp_file.write(file_bytes)
                tmp_file.flush()

                result = converter.convert(tmp_file.name)
                markdown_text = result.document.export_to_markdown()

        # 3. Upload extracted Markdown back to Supabase
        output_path = f"parsed/{document_id}.md"
        supabase.storage.from_(settings.PARSED_BUCKET).upload(
            path=output_path,
            file=markdown_text.encode("utf-8"),
            file_options={"content-type": "text/markdown; charset=utf-8", "upsert": "true"},
        )

        ocr_confidence = 1.0
        text_coverage = 1.0 if len(markdown_text.strip()) > 0 else 0.0

        # 4. Notify pipeline outbox and events
        _insert_pipeline_event(
            document_id, user_id, f"Extracted {len(markdown_text)} characters"
        )
        _write_outbox_extracted(
            analysis_request_id=analysis_request_id,
            document_id=document_id,
            user_id=user_id,
            storage_path=storage_path,
            mime_type=mime_type,
            analysis_version=analysis_version,
            markdown_storage_path=output_path,
            ocr_confidence=ocr_confidence,
            text_coverage=text_coverage,
        )

        print(f"✅ Finished job {job_id} successfully.")
        return {
            "status": "completed",
            "markdownStoragePath": output_path,
            "charCount": len(markdown_text),
        }

    except Exception as e:
        print(f"❌ Error processing job {job_id}: {str(e)}")
        traceback.print_exc()
        raise e  # Re-raise so BullMQ marks it as failed rather than hanging

async def process_ocr_job(job, job_token):
    """
    BullMQ Async Job Handler.
    We delegate all synchronous Supabase API calls and Docling processing 
    to a separate thread using asyncio.to_thread().
    """
    return await asyncio.to_thread(_process_job_sync, job.id, job.name, job.data)


async def main():
    worker = Worker(
        QUEUE_NAME,
        process_ocr_job,
        get_worker_options(),
    )
    print(f"🚀 Python Docling OCR Worker is running and listening to '{QUEUE_NAME}' for job '{EXPECTED_JOB_NAME}'...")

    shutdown_event = asyncio.Event()

    def handle_signal():
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, handle_signal)

    await shutdown_event.wait()
    await worker.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Docling OCR Worker & CLI Tool")
    parser.add_argument(
        "-f",
        "--file",
        type=str,
        help="Path to a local PDF or document file to convert directly to Markdown.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        help="Optional output path for the .md file. Defaults to <filename>.md.",
    )

    args = parser.parse_args()
    
    warmup_docling_models()

    if args.file:
        process_local_file(args.file, args.output)
    else:
        asyncio.run(main())