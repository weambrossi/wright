import type { ImportMode } from "@/lib/document/wrightDocumentTypes";

export const MAX_UPLOAD_SIZE_MB = 20;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export type SupportedImportKey = "docx" | "txt" | "markdown" | "pdf";

export interface SupportedImportType {
  extensions: string[];
  mimeTypes: string[];
  importMode: ImportMode;
  label: string;
}

export const SUPPORTED_IMPORT_TYPES: Record<
  SupportedImportKey,
  SupportedImportType
> = {
  docx: {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
      "",
    ],
    importMode: "editable",
    label: "Word document",
  },
  txt: {
    extensions: [".txt"],
    mimeTypes: ["text/plain", "application/octet-stream", ""],
    importMode: "editable",
    label: "Plain text",
  },
  markdown: {
    extensions: [".md", ".markdown"],
    mimeTypes: ["text/markdown", "text/x-markdown", "text/plain", ""],
    importMode: "editable",
    label: "Markdown",
  },
  pdf: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf", "application/octet-stream", ""],
    importMode: "reference",
    label: "PDF",
  },
};

export const ACCEPTED_IMPORT_FILE_TYPES =
  ".docx,.txt,.md,.markdown,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/pdf";

export function getSupportedTypeForFilename(
  filename: string
): [SupportedImportKey, SupportedImportType] | null {
  const lower = filename.toLowerCase();
  const match = Object.entries(SUPPORTED_IMPORT_TYPES).find(([, config]) =>
    config.extensions.some((ext) => lower.endsWith(ext))
  );
  return (match as [SupportedImportKey, SupportedImportType] | undefined) ?? null;
}

export function fileTypeSummary() {
  return ".docx, .txt, .md, and .pdf";
}
