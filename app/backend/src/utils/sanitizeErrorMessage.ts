export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorText(error.message);
  }

  if (typeof error === "string") {
    return sanitizeErrorText(error);
  }

  return "The document processing service encountered an unexpected error.";
}

function sanitizeErrorText(message: string): string {
  const normalized = message.trim();

  if (!normalized) {
    return "The document processing service encountered an unexpected error.";
  }

  const stackTraceIndicators = [
    /require stack/i,
    /possible solutions:/i,
    /install with verbose logging/i,
    /sharp-linux-x64\.node/i,
    /node_modules[\\/].*sharp/i,
  ];

  if (stackTraceIndicators.some((indicator) => indicator.test(normalized))) {
    return "The document processing service encountered an unexpected error.";
  }

  return normalized;
}
