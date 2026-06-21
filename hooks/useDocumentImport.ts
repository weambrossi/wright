"use client";

import { useCallback, useState } from "react";
import type {
  ImportWarning,
  SourceFileSummary,
  WrightDocument,
} from "@/lib/document/wrightDocumentTypes";

export interface DocumentImportResult {
  document: WrightDocument;
  sourceFile: SourceFileSummary;
  warnings: ImportWarning[];
}

interface ImportFileOptions {
  documentId?: string;
  title?: string;
}

export function useDocumentImport() {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFile = useCallback(
    async (
      file: File,
      options: ImportFileOptions = {}
    ): Promise<DocumentImportResult> => {
      setImporting(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (options.documentId) fd.append("documentId", options.documentId);
        if (options.title) fd.append("title", options.title);
        const res = await fetch("/api/documents/import", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Could not import that document");
        }
        return (await res.json()) as DocumentImportResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        setError(message);
        throw new Error(message);
      } finally {
        setImporting(false);
      }
    },
    []
  );

  return { importFile, importing, error };
}
