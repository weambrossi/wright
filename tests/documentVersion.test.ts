import { describe, expect, it } from "vitest";
import {
  fingerprintDocumentText,
  checkInsertionSafety,
} from "@/lib/writing/documentVersion";

describe("fingerprintDocumentText", () => {
  it("is deterministic", () => {
    expect(fingerprintDocumentText("hello world")).toBe(
      fingerprintDocumentText("hello world")
    );
  });

  it("changes when the text changes", () => {
    expect(fingerprintDocumentText("hello world")).not.toBe(
      fingerprintDocumentText("hello world!")
    );
  });
});

describe("checkInsertionSafety", () => {
  const text = "The manuscript text.";
  const version = fingerprintDocumentText(text);

  it("passes when nothing changed", () => {
    expect(
      checkInsertionSafety({
        originalVersion: version,
        currentText: text,
        selectionStart: 1,
        selectionEnd: 5,
        currentDocSize: 100,
      })
    ).toEqual({ ok: true });
  });

  it("flags a changed document", () => {
    const result = checkInsertionSafety({
      originalVersion: version,
      currentText: text + " Edited.",
      currentDocSize: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("document_changed");
  });

  it("flags an out-of-range selection", () => {
    const result = checkInsertionSafety({
      originalVersion: version,
      currentText: text,
      selectionStart: 90,
      selectionEnd: 120,
      currentDocSize: 100,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("selection_invalid");
  });
});
