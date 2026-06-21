import { editorJsonToAIText } from "@/lib/document/serializeForAI";
import { importDocument } from "@/lib/import/importDocument";
import type { ImporterInput } from "@/lib/import/importTypes";
import {
  getSupportedTypeForFilename,
  type SupportedImportKey,
} from "@/lib/import/supportedFileTypes";
import {
  ImportValidationError,
  type FileLike,
} from "@/lib/import/validateFile";

export const CHAT_CONTEXT_ACCEPT =
  ".docx,.txt,.md,.markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

export const MAX_CHAT_CONTEXT_FILES = 3;
export const MAX_CHAT_FILE_SIZE_MB = 5;
export const MAX_CHAT_FILE_SIZE_BYTES = MAX_CHAT_FILE_SIZE_MB * 1024 * 1024;
export const MAX_CHAT_CONTEXT_CHARS = 30_000;

export interface ChatFileAttachment {
  id: string;
  name: string;
  text: string;
  truncated?: boolean;
}

export function validateChatContextFile(file: FileLike): SupportedImportKey {
  if (!file) {
    throw new ImportValidationError("No file was uploaded.", "missing_file");
  }

  if (file.size <= 0) {
    throw new ImportValidationError(
      "That file is empty. Try a document with some content.",
      "empty_file"
    );
  }

  if (file.size > MAX_CHAT_FILE_SIZE_BYTES) {
    throw new ImportValidationError(
      `That file is too large. Attach files up to ${MAX_CHAT_FILE_SIZE_MB} MB.`,
      "file_too_large"
    );
  }

  const supported = getSupportedTypeForFilename(file.name);
  if (!supported) {
    throw new ImportValidationError(
      "We couldn't attach that file type. Try a .docx, .txt, or .md file.",
      "unsupported_type"
    );
  }

  const [key] = supported;
  if (key === "pdf") {
    throw new ImportValidationError(
      "PDF text isn't available for chat context yet. Try a .docx, .txt, or .md file.",
      "unsupported_type"
    );
  }

  return key;
}

export async function extractChatFileText(
  type: SupportedImportKey,
  input: ImporterInput
): Promise<{ text: string; truncated: boolean }> {
  if (type === "txt" || type === "markdown") {
    const text = input.buffer.toString("utf8").replace(/\u0000/g, "").trim();
    if (!text) {
      throw new ImportValidationError(
        "That file is empty. Try a document with some content.",
        "empty_file"
      );
    }
    return truncateText(text);
  }

  const imported = await importDocument(type, input);
  const text = editorJsonToAIText(imported.contentJson).trim();
  if (!text) {
    throw new ImportValidationError(
      "We couldn't read any text from that file.",
      "empty_file"
    );
  }
  return truncateText(text);
}

export function buildChatUserContent(
  typed: string,
  selection: string | null,
  files: ChatFileAttachment[]
): string {
  const parts: string[] = [];
  if (typed) parts.push(typed);

  if (selection?.trim()) {
    parts.push(
      `\n\nSelected passage from document:\n"""\n${selection.trim()}\n"""`
    );
  }

  if (files.length > 0) {
    const fileBlock = files
      .map((file) => {
        const suffix = file.truncated ? "\n[Content truncated for length]" : "";
        return `--- ${file.name} ---\n${file.text}${suffix}`;
      })
      .join("\n\n");
    parts.push(
      `\n\nAttached file${files.length > 1 ? "s" : ""} for context:\n"""\n${fileBlock}\n"""`
    );
  }

  return parts.join("").trim();
}

export function chatUserPreview(
  typed: string,
  files: ChatFileAttachment[],
  selection?: string | null
): string {
  if (typed.trim()) return typed.trim();
  if (selection?.trim()) return selection.trim();
  if (files.length === 1) return files[0].name;
  return `${files.length} attached files`;
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CHAT_CONTEXT_CHARS) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, MAX_CHAT_CONTEXT_CHARS),
    truncated: true,
  };
}

export function isTextContextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown")
  );
}
