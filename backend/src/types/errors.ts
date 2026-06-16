export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class DocumentNotFoundError extends AppError {
  constructor(documentId: string) {
    super(404, `Document ${documentId} not found`, 'DOCUMENT_NOT_FOUND');
  }
}

export class ForbiddenDocumentAccessError extends AppError {
  constructor(documentId: string) {
    super(403, `You do not have access to document ${documentId}`, 'DOCUMENT_FORBIDDEN');
  }
}

export class UploadNotCompleteError extends AppError {
  constructor(documentId: string, uploadStatus: string) {
    super(
      409,
      `Document ${documentId} upload is not complete (status=${uploadStatus})`,
      'UPLOAD_NOT_COMPLETE',
    );
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(409, `Invalid state transition from ${from} to ${to}`, 'INVALID_TRANSITION');
  }
}

export class OutboxDispatchError extends AppError {
  constructor(message: string, details?: unknown) {
    super(500, message, 'OUTBOX_DISPATCH_FAILED', details);
  }
}

export class UnsupportedFileTypeError extends AppError {
  constructor(mimeType: string) {
    super(415, `Unsupported file type: ${mimeType}`, 'UNSUPPORTED_FILE_TYPE');
  }
}

export class ExtractionFailedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(500, message, 'EXTRACTION_FAILED', details);
  }
}

export class OcrFailedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(500, message, 'OCR_FAILED', details);
  }
}
