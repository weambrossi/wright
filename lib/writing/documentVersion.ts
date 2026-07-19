// Client-safe document fingerprinting for insertion safety. Captured when a
// writing request starts; before inserting generated text the client compares
// the current fingerprint so a changed document triggers a review step
// instead of a blind insert.

export function fingerprintDocumentText(text: string): string {
  // djb2 — tiny, fast, deterministic; collisions are acceptable because the
  // fingerprint only gates a confirmation dialog, not data integrity.
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

export interface InsertionCheck {
  ok: boolean;
  reason?: "document_changed" | "selection_invalid";
}

export function checkInsertionSafety(input: {
  originalVersion?: string;
  currentText: string;
  selectionStart?: number;
  selectionEnd?: number;
  /** Size of the current editor doc in ProseMirror positions. */
  currentDocSize: number;
}): InsertionCheck {
  if (
    input.selectionStart != null &&
    input.selectionEnd != null &&
    (input.selectionStart > input.currentDocSize ||
      input.selectionEnd > input.currentDocSize)
  ) {
    return { ok: false, reason: "selection_invalid" };
  }
  if (
    input.originalVersion &&
    fingerprintDocumentText(input.currentText) !== input.originalVersion
  ) {
    return { ok: false, reason: "document_changed" };
  }
  return { ok: true };
}
