import { editorJsonToHtml, textToEditorJson } from "@/lib/import/editorConversion";
import type { ImportedDocumentContent, ImporterInput } from "@/lib/import/importTypes";

export async function importText(
  input: ImporterInput
): Promise<ImportedDocumentContent> {
  const text = input.buffer.toString("utf8").replace(/\u0000/g, "");
  const contentJson = textToEditorJson(text);
  return {
    title: titleFromFilename(input.filename, /\.(txt)$/i),
    contentJson,
    html: editorJsonToHtml(contentJson),
    importMode: "editable",
    warnings: [],
  };
}

function titleFromFilename(filename: string, extension: RegExp) {
  return filename.replace(extension, "").trim() || "Imported Document";
}
