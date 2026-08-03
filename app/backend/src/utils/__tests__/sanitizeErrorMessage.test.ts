import { describe, expect, it } from "vitest";
import { sanitizeErrorMessage } from "../sanitizeErrorMessage";

describe("sanitizeErrorMessage", () => {
  it("replaces verbose native module stack traces with a generic message", () => {
    const input =
      'Something went wrong installing the "sharp" module Cannot find module \'../build/Release/sharp-linux-x64.node\' Require stack: - /home/wahb-amir/Desktop/hackathon/USAII/clearpath/node_modules/.pnpm/sharp@0.32.6/node_modules/sharp/lib/sharp.js Possible solutions: - Install with verbose logging';

    expect(sanitizeErrorMessage(input)).toBe(
      "The document processing service encountered an unexpected error.",
    );
  });

  it("preserves concise application errors", () => {
    expect(sanitizeErrorMessage("Unsupported file type: application/pdf")).toBe(
      "Unsupported file type: application/pdf",
    );
  });
});
