import argparse
import asyncio
from pathlib import Path
import signal
import tempfile

from bullmq import Worker
from supabase import create_client, Client
from docling.document_converter import DocumentConverter, PdfFormatOption
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
    format_options={"pdf": PdfFormatOption(pipeline_options=pipeline_options)}
)


def process_local_file(file_path: str, output_path: str | None = None) -> None:
    """Processes a local file directly using Docling and saves the output to a .md file."""
    input_path = Path(file_path)

    if not input_path.exists():
        print(f"❌ Error: File standard path '{file_path}' does not exist.")
        return

    # Default output path to input_filename.md if not specified
    if output_path:
        destination_path = Path(output_path)
    else:
        destination_path = input_path.with_suffix(".md")

    print(f"📄 Processing local file: {input_path}")
    result = converter.convert(str(input_path))
    markdown_text = result.document.export_to_markdown()

    destination_path.write_text(markdown_text, encoding="utf-8")
    print(
        f"✅ Successfully extracted {len(markdown_text)} characters and saved to '{destination_path}'"
    )


def _report_extracting(document_id: str) -> None:
    """Best-effort status update, mirroring the Node worker's reportStage
    for the EXTRACTING transition. Not wrapped in a DB transaction/lock
    like the Node side - acceptable here since this is the only writer
    for this particular transition."""
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
    """Writes the 'document.extracted' outbox row. The AFTER INSERT
    trigger on document_pipeline_outbox fires regardless of which
    client performed the insert, so the Node dispatcher's LISTEN/NOTIFY
    picks this up exactly like a Node-written row."""
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


async def process_ocr_job(job, job_token):
    assert_should_process_job(job.name, EXPECTED_JOB_NAME)

    document_id = job.data.get("documentId")
    user_id = job.data.get("userId")
    analysis_request_id = job.data.get("analysisRequestId")
    storage_path = job.data.get("storagePath")
    mime_type = job.data.get("mimeType")
    analysis_version = job.data.get("analysisVersion")

    print(f"[OCR Worker] Processing job {job.id} for path: {storage_path}")

    _report_extracting(document_id)

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp_file:
        # 1. Download the originally-uploaded file from Supabase Storage.
        #    Bucket must match where the Node backend uploads to
        #    (`documents`, see workers/stages/extractionStage.ts).
        file_bytes = supabase.storage.from_(settings.RAW_BUCKET).download(storage_path)
        tmp_file.write(file_bytes)
        tmp_file.flush()

        # 2. Run Docling OCR & Layout parsing
        result = converter.convert(tmp_file.name)
        markdown_text = result.document.export_to_markdown()

        # 3. Upload Markdown to the parsed-documents bucket
        output_path = f"parsed/{document_id}.md"
        supabase.storage.from_(settings.PARSED_BUCKET).upload(
            path=output_path,
            file=markdown_text.encode("utf-8"),
            file_options={"content-type": "text/markdown; charset=utf-8", "upsert": "true"},
        )

        # Docling doesn't expose a single scalar OCR-confidence figure for
        # this pipeline configuration; default to a high-confidence value
        # rather than leaving quality estimation entirely blank. Node's
        # stage-cleaning handler folds this into estimateQuality().
        ocr_confidence = 1.0
        text_coverage = 1.0 if len(markdown_text.strip()) > 0 else 0.0

        # 4. Tell the rest of the pipeline extraction is done.
        _insert_pipeline_event(
            document_id, user_id, f"Extracted {len(markdown_text)} characters via Docling"
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

        return {
            "status": "completed",
            "markdownStoragePath": output_path,
            "charCount": len(markdown_text),
        }


async def main():
    # Target the exact queue name used by the Node backend's producer
    worker = Worker(
        QUEUE_NAME,
        process_ocr_job,
        get_worker_options(),
    )
    print(
        f"🚀 Python Docling OCR Worker is running and listening to '{QUEUE_NAME}' for job '{EXPECTED_JOB_NAME}'..."
    )

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

    if args.file:
        process_local_file(args.file, args.output)
    else:
        asyncio.run(main())