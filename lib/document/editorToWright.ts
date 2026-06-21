import type { JSONContent } from "@tiptap/core";
import { ensureDoc } from "@/lib/document/wrightToEditor";
import type {
  ImportWarning,
  WrightDocument,
  WrightDocumentSource,
} from "@/lib/document/wrightDocumentTypes";

interface EditorToWrightOptions {
  id: string;
  title: string;
  content: JSONContent;
  source?: WrightDocumentSource;
  createdAt?: string;
  updatedAt?: string;
  warnings?: ImportWarning[];
}

export function editorStateToWrightDocument(
  options: EditorToWrightOptions
): WrightDocument {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  return {
    id: options.id,
    title: options.title || "Untitled Document",
    version: 1,
    source: options.source,
    content: ensureDoc(options.content),
    metadata: {
      createdAt: options.createdAt ?? updatedAt,
      updatedAt,
      wordCount: countWords(options.content),
      importWarnings: options.warnings,
    },
  };
}

export function countWords(content: JSONContent): number {
  const text = collectText(content).trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function collectText(node: JSONContent): string {
  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = (node.content ?? []).map(collectText).join(" ");
  return `${ownText} ${childText}`;
}
