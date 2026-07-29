import { describe, it, expect } from "vitest";
import {
  detectFileCategory,
} from "../../stages/detectFileType";
import { UnsupportedFileTypeError } from "../../../types/errors";

describe("detectFileCategory", () => {
  it("returns 'pdf' for application/pdf", () => {
    expect(detectFileCategory("application/pdf")).toBe("pdf");
  });

  it("returns 'pdf' for uppercase MIME (normalised)", () => {
    expect(detectFileCategory("APPLICATION/PDF")).toBe("pdf");
  });

  it("returns 'text' for text/plain", () => {
    expect(detectFileCategory("text/plain")).toBe("text");
  });

  it("returns 'text' for text/markdown", () => {
    expect(detectFileCategory("text/markdown")).toBe("text");
  });

  it("returns 'text' for text/csv", () => {
    expect(detectFileCategory("text/csv")).toBe("text");
  });

  it("returns 'text' for application/json", () => {
    expect(detectFileCategory("application/json")).toBe("text");
  });

  it("returns 'screenshot_or_scan' for image/png", () => {
    expect(detectFileCategory("image/png")).toBe("screenshot_or_scan");
  });

  it("returns 'screenshot_or_scan' for image/jpeg", () => {
    expect(detectFileCategory("image/jpeg")).toBe("screenshot_or_scan");
  });

  it("returns 'screenshot_or_scan' for image/jpg", () => {
    expect(detectFileCategory("image/jpg")).toBe("screenshot_or_scan");
  });

  it("returns 'screenshot_or_scan' for image/webp", () => {
    expect(detectFileCategory("image/webp")).toBe("screenshot_or_scan");
  });

  it("returns 'screenshot_or_scan' for image/tiff", () => {
    expect(detectFileCategory("image/tiff")).toBe("screenshot_or_scan");
  });

  it("returns 'screenshot_or_scan' for image/bmp", () => {
    expect(detectFileCategory("image/bmp")).toBe("screenshot_or_scan");
  });

  it("throws UnsupportedFileTypeError for unknown MIME type", () => {
    expect(() => detectFileCategory("application/msword")).toThrow(
      UnsupportedFileTypeError,
    );
  });

  it("throws UnsupportedFileTypeError for video/mp4", () => {
    expect(() => detectFileCategory("video/mp4")).toThrow(
      UnsupportedFileTypeError,
    );
  });

  it("error message contains the unsupported MIME type", () => {
    expect(() => detectFileCategory("application/zip")).toThrowError(
      /application\/zip/,
    );
  });
});
