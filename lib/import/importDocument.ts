import type { SupportedImportKey } from "@/lib/import/supportedFileTypes";
import type { ImportedDocumentContent, ImporterInput } from "@/lib/import/importTypes";
import { importDocx } from "@/lib/import/importDocx";
import { importMarkdown } from "@/lib/import/importMarkdown";
import { importPdf } from "@/lib/import/importPdf";
import { importText } from "@/lib/import/importText";

export async function importDocument(
  type: SupportedImportKey,
  input: ImporterInput
): Promise<ImportedDocumentContent> {
  switch (type) {
    case "docx":
      return importDocx(input);
    case "txt":
      return importText(input);
    case "markdown":
      return importMarkdown(input);
    case "pdf":
      return importPdf(input);
  }
}
