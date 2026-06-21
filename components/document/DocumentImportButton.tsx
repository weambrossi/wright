"use client";

import { useRef } from "react";
import { ACCEPTED_IMPORT_FILE_TYPES } from "@/lib/import/supportedFileTypes";
import {
  useDocumentImport,
  type DocumentImportResult,
} from "@/hooks/useDocumentImport";

interface DocumentImportButtonProps {
  label?: string;
  busyLabel?: string;
  className?: string;
  documentId?: string;
  title?: string;
  disabled?: boolean;
  showHelper?: boolean;
  beforeImport?: (file: File) => Promise<boolean> | boolean;
  onImported: (result: DocumentImportResult, file: File) => void;
  onError?: (message: string) => void;
}

export function DocumentImportButton({
  label = "Import",
  busyLabel = "Importing...",
  className,
  documentId,
  title,
  disabled,
  showHelper,
  beforeImport,
  onImported,
  onError,
}: DocumentImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFile, importing, error } = useDocumentImport();
  const isDisabled = disabled || importing;

  const handleFile = async (file: File) => {
    const shouldImport = beforeImport ? await beforeImport(file) : true;
    if (!shouldImport) return;
    try {
      const result = await importFile(file, { documentId, title });
      onImported(result, file);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "We couldn't import this file.");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isDisabled}
        className={className}
      >
        {importing ? busyLabel : label}
      </button>
      {showHelper && (
        <div className="text-xs leading-relaxed text-neutral-500">
          Upload .docx, .txt, .md, or .pdf. DOCX becomes editable; PDF imports
          as a reference.
        </div>
      )}
      {error && <div className="text-xs text-red-soft">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMPORT_FILE_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
