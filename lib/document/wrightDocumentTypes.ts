import type { JSONContent } from "@tiptap/core";

export type ImportMode = "editable" | "reference";

export type ImportWarningCode =
  | "advanced_formatting_not_supported"
  | "headers_footers_not_imported"
  | "complex_tables_simplified"
  | "pdf_reference_only"
  | "images_skipped"
  | "unsupported_elements_removed"
  | "importer_message";

export interface ImportWarning {
  code: ImportWarningCode;
  message: string;
}

export interface WrightDocumentSource {
  id?: string;
  originalFileName: string;
  originalFileType: string;
  originalFileSize: number;
  originalFileUrl?: string;
  importMode: ImportMode;
  importedAt: string;
}

export interface WrightDocumentMetadata {
  createdAt: string;
  updatedAt: string;
  wordCount?: number;
  importWarnings?: ImportWarning[];
}

export interface WrightDocument {
  id: string;
  title: string;
  version: number;
  source?: WrightDocumentSource;
  content: JSONContent;
  metadata: WrightDocumentMetadata;
}

export interface SourceFileSummary {
  id: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  importMode: ImportMode;
}
