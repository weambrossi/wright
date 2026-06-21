import type { JSONContent } from "@tiptap/core";
import type { WrightDocument } from "@/lib/document/wrightDocumentTypes";

export function wrightDocumentToEditorState(
  document: Pick<WrightDocument, "content">
): JSONContent {
  return ensureDoc(document.content);
}

export function ensureDoc(content: JSONContent | null | undefined): JSONContent {
  if (!content || typeof content !== "object") return emptyEditorDoc();
  if (content.type === "doc") return content;
  return { type: "doc", content: [content] };
}

export function emptyEditorDoc(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}
