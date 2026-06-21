import {
  getSupportedTypeForFilename,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
  type SupportedImportKey,
  type SupportedImportType,
} from "@/lib/import/supportedFileTypes";

export class ImportValidationError extends Error {
  constructor(
    message: string,
    public code:
      | "missing_file"
      | "unsupported_type"
      | "file_too_large"
      | "empty_file"
      | "mime_mismatch"
  ) {
    super(message);
    this.name = "ImportValidationError";
  }
}

export interface FileLike {
  name: string;
  type?: string;
  size: number;
}

export interface ValidatedImportFile {
  key: SupportedImportKey;
  config: SupportedImportType;
}

export function validateImportFile(file: FileLike): ValidatedImportFile {
  if (!file) {
    throw new ImportValidationError("No file was uploaded.", "missing_file");
  }

  if (file.size <= 0) {
    throw new ImportValidationError(
      "That file is empty. Try a document with some content.",
      "empty_file"
    );
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new ImportValidationError(
      `That file is too large. Upload files up to ${MAX_UPLOAD_SIZE_MB} MB.`,
      "file_too_large"
    );
  }

  const supported = getSupportedTypeForFilename(file.name);
  if (!supported) {
    throw new ImportValidationError(
      "We couldn't import that file type. Try a .docx, .txt, .md, or .pdf file.",
      "unsupported_type"
    );
  }

  const [key, config] = supported;
  const mime = (file.type ?? "").toLowerCase();
  const allowedMimes = config.mimeTypes.map((type) => type.toLowerCase());
  if (!allowedMimes.includes(mime)) {
    throw new ImportValidationError(
      `That file does not look like a ${config.label}. Try exporting it again and re-uploading.`,
      "mime_mismatch"
    );
  }

  return { key, config };
}
