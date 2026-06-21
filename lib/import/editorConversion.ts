import type { JSONContent } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";
import { getWrightExtensions } from "@/lib/tiptap/extensions";
import { emptyEditorDoc, ensureDoc } from "@/lib/document/wrightToEditor";

const extensions = getWrightExtensions();

export function htmlToEditorJson(html: string): JSONContent {
  if (!html.trim()) return emptyEditorDoc();
  return ensureDoc(generateJSON(html, extensions));
}

export function editorJsonToHtml(content: JSONContent): string {
  return generateHTML(ensureDoc(content), extensions);
}

export function textToEditorJson(text: string): JSONContent {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return emptyEditorDoc();

  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: textRunsWithBreaks(paragraph),
    })),
  };
}

function textRunsWithBreaks(text: string): JSONContent[] {
  const lines = text.split(/\r?\n/);
  return lines.flatMap((line, index) => {
    const nodes: JSONContent[] = [];
    if (index > 0) nodes.push({ type: "hardBreak" });
    if (line) nodes.push({ type: "text", text: line });
    return nodes;
  });
}
