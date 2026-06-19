/**
 * Lightweight language detection without an external dependency.
 * Detects English vs Urdu via Unicode script ranges (Urdu uses the
 * Arabic script block), with room to extend for additional languages
 * by adding more script-range heuristics.
 *
 * For broader coverage later, swap in a library like `franc` -
 * the interface (detectLanguage(text) -> { code, name }) stays the same.
 */

export interface LanguageDetectionResult {
  code: string; // ISO 639-1
  name: string;
}

const ARABIC_SCRIPT_RANGE = /[\u0600-\u06FF\u0750-\u077F]/;

export function detectLanguage(text: string): LanguageDetectionResult {
  const sample = text.slice(0, 5000);

  const arabicScriptChars = (sample.match(ARABIC_SCRIPT_RANGE) ?? []).length;
  const latinChars = (sample.match(/[A-Za-z]/g) ?? []).length;

  if (arabicScriptChars > latinChars && arabicScriptChars > 10) {
    // Urdu uses the Arabic script; without a dedicated Arabic-vs-Urdu
    // classifier we default to Urdu, which is the documented use case.
    return { code: "ur", name: "Urdu" };
  }

  if (latinChars > 10) {
    return { code: "en", name: "English" };
  }

  return { code: "unknown", name: "Unknown" };
}
