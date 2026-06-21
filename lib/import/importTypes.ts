import type { JSONContent } from "@tiptap/core";
import type { ImportMode, ImportWarning } from "@/lib/document/wrightDocumentTypes";

export interface ImporterInput {
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface ImportedDocumentContent {
  title: string;
  contentJson: JSONContent;
  html: string;
  importMode: ImportMode;
  warnings: ImportWarning[];
}
