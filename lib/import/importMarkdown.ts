import MarkdownIt from "markdown-it";
import { editorJsonToHtml, htmlToEditorJson } from "@/lib/import/editorConversion";
import { sanitizeImportedHtml } from "@/lib/import/sanitizeHtml";
import type { ImportedDocumentContent, ImporterInput } from "@/lib/import/importTypes";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

export async function importMarkdown(
  input: ImporterInput
): Promise<ImportedDocumentContent> {
  const markdown = input.buffer.toString("utf8").replace(/\u0000/g, "");
  const sanitizedHtml = sanitizeImportedHtml(md.render(markdown));
  const contentJson = htmlToEditorJson(sanitizedHtml);

  return {
    title: input.filename.replace(/\.(md|markdown)$/i, "").trim() || "Imported Document",
    contentJson,
    html: editorJsonToHtml(contentJson),
    importMode: "editable",
    warnings: [],
  };
}
