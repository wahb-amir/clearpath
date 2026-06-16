import type { DocumentQuality } from '../../types/pipelineStatus';

export interface QualityEstimate {
  quality: DocumentQuality;
  ocrConfidence: number;
  textCoverage: number;
}

/**
 * Derives a coarse quality label from OCR confidence and text coverage,
 * used for documents.quality and the final processing summary.
 */
export function estimateQuality(params: {
  ocrConfidence: number;
  textCoverage: number;
}): QualityEstimate {
  const { ocrConfidence, textCoverage } = params;
  const score = ocrConfidence * 0.7 + textCoverage * 0.3;

  let quality: DocumentQuality;
  if (score >= 0.85) quality = 'good';
  else if (score >= 0.6) quality = 'medium';
  else if (score > 0) quality = 'poor';
  else quality = 'unknown';

  return { quality, ocrConfidence, textCoverage };
}
