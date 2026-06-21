import { editorJsonToHtml, textToEditorJson } from "@/lib/import/editorConversion";
import type { ImportedDocumentContent, ImporterInput } from "@/lib/import/importTypes";

export async function importPdf(
  input: ImporterInput
): Promise<ImportedDocumentContent> {
  const title = input.filename.replace(/\.pdf$/i, "").trim() || "Imported PDF";
  const contentJson = textToEditorJson(
    `PDF reference: ${input.filename}\n\nPDFs are imported as reference documents. Text can be extracted for AI editing in a later version, but original PDF layout is not fully editable in Wright yet.`
  );

  return {
    title,
    contentJson,
    html: editorJsonToHtml(contentJson),
    importMode: "reference",
    warnings: [
      {
        code: "pdf_reference_only",
        message:
          "PDFs are imported as reference documents. Original layout editing is limited.",
      },
    ],
  };
}
