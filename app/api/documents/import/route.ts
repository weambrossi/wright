import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createImportedDocument,
  toWrightDocument,
  updateDocument,
  upsertSourceFile,
} from "@/lib/documentStore";
import { importDocument } from "@/lib/import/importDocument";
import { storeOriginalFile } from "@/lib/import/storeOriginalFile";
import { validateImportFile, ImportValidationError } from "@/lib/import/validateFile";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const requestedTitle = stringValue(formData.get("title"));
    const existingDocumentId = stringValue(formData.get("documentId"));

    if (!file || !(file instanceof File)) {
      throw new ImportValidationError("No file was uploaded.", "missing_file");
    }

    const validated = validateImportFile(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    const imported = await importDocument(validated.key, {
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      buffer,
    });

    const documentId = existingDocumentId || randomUUID();
    const sourceFileId = randomUUID();
    const title = requestedTitle || imported.title;

    const storagePath = await storeOriginalFile({
      documentId,
      sourceFileId,
      filename: file.name,
      mimeType: file.type,
      buffer,
    });

    if (!existingDocumentId) {
      await createImportedDocument({
        id: documentId,
        title,
        html: imported.html,
        contentJson: imported.contentJson,
        warnings: imported.warnings,
      });
    }

    const sourceFile = await upsertSourceFile({
      id: sourceFileId,
      documentId,
      originalFileName: file.name,
      fileType: validated.key,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
      storagePath,
      importMode: imported.importMode,
    });

    if (existingDocumentId) {
      await updateDocument(existingDocumentId, {
        title,
        html: imported.html,
        contentJson: imported.contentJson,
        importStatus: "ready",
        importWarnings: imported.warnings,
        sourceFileId,
      });
    } else {
      await updateDocument(documentId, {
        sourceFileId,
      });
    }

    const now = new Date().toISOString();
    const document = toWrightDocument({
      id: documentId,
      title,
      contentJson: imported.contentJson,
      source: {
        id: sourceFileId,
        originalFileName: file.name,
        originalFileType: validated.key,
        originalFileSize: file.size,
        importMode: imported.importMode,
        importedAt: now,
      },
      warnings: imported.warnings,
      updatedAt: now,
    });

    return NextResponse.json({
      document,
      sourceFile,
      warnings: imported.warnings,
    });
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }

    console.error("Document import failed", err);
    const message =
      err instanceof Error
        ? err.message
        : "We couldn't import this file. Try a .docx, .txt, .md, or .pdf file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
