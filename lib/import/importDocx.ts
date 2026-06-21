import mammoth from "mammoth";
import { editorJsonToHtml, htmlToEditorJson } from "@/lib/import/editorConversion";
import { sanitizeImportedHtml } from "@/lib/import/sanitizeHtml";
import type { ImportedDocumentContent, ImporterInput } from "@/lib/import/importTypes";
import type { ImportWarning } from "@/lib/document/wrightDocumentTypes";

export async function importDocx(
  input: ImporterInput
): Promise<ImportedDocumentContent> {
  try {
    const result = await mammoth.convertToHtml(
      { buffer: input.buffer },
      {
        convertImage: mammoth.images.imgElement((image) =>
          image.read("base64").then((base64) => ({
            src: `data:${image.contentType};base64,${base64}`,
          }))
        ),
      }
    );

    const warnings: ImportWarning[] = [
      {
        code: "advanced_formatting_not_supported",
        message:
          "Some advanced Word formatting may be simplified in the editable document.",
      },
      {
        code: "headers_footers_not_imported",
        message: "Headers and footers are not editable yet.",
      },
      ...result.messages.map((message) => ({
        code: "importer_message" as const,
        message: message.message,
      })),
    ];

    if (/<table[\s>]/i.test(result.value)) {
      warnings.push({
        code: "complex_tables_simplified",
        message: "Complex tables may import with simplified formatting.",
      });
    }

    if (!/<img[\s>]/i.test(result.value)) {
      warnings.push({
        code: "images_skipped",
        message:
          "Images are imported when possible, but some Word images may be skipped.",
      });
    }

    const sanitizedHtml = sanitizeImportedHtml(result.value);
    const contentJson = htmlToEditorJson(sanitizedHtml);

    return {
      title: titleFromFilename(input.filename),
      contentJson,
      html: editorJsonToHtml(contentJson),
      importMode: "editable",
      warnings,
    };
  } catch {
    throw new Error(
      "We couldn't import that Word document. It may be corrupt, encrypted, or password-protected."
    );
  }
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.docx$/i, "").trim() || "Imported Document";
}
