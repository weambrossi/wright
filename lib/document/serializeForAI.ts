import type { JSONContent } from "@tiptap/core";

export function editorJsonToAIText(content: JSONContent): string {
  return serializeNode(content, 0).replace(/\n{3,}/g, "\n\n").trim();
}

function serializeNode(node: JSONContent, depth: number): string {
  switch (node.type) {
    case "doc":
      return serializeChildren(node, depth).join("\n\n");
    case "heading": {
      const level = Math.max(1, Math.min(Number(node.attrs?.level ?? 1), 6));
      return `${"#".repeat(level)} ${inlineText(node)}`.trim();
    }
    case "paragraph":
      return inlineText(node);
    case "bulletList":
      return serializeChildren(node, depth).join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((child, index) => `${index + 1}. ${serializeNode(child, depth).trim()}`)
        .join("\n");
    case "listItem":
      return `${"  ".repeat(depth)}- ${serializeChildren(node, depth + 1)
        .join("\n")
        .trim()}`;
    case "table":
      return serializeChildren(node, depth).join("\n");
    case "tableRow":
      return `| ${serializeChildren(node, depth).join(" | ")} |`;
    case "tableCell":
    case "tableHeader":
      return inlineText(node) || serializeChildren(node, depth).join(" ");
    case "blockquote":
      return serializeChildren(node, depth)
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "horizontalRule":
      return "---";
    case "pageBreak":
      return "[Page break]";
    case "image":
      return node.attrs?.alt ? `[Image: ${node.attrs.alt}]` : "[Image]";
    case "hardBreak":
      return "\n";
    case "text":
      return node.text ?? "";
    default:
      return serializeChildren(node, depth).join(" ");
  }
}

function serializeChildren(node: JSONContent, depth: number): string[] {
  return (node.content ?? [])
    .map((child) => serializeNode(child, depth))
    .map((s) => s.trim())
    .filter(Boolean);
}

function inlineText(node: JSONContent): string {
  return (node.content ?? [])
    .map((child) => {
      if (child.type === "hardBreak") return "\n";
      if (child.type === "text") return child.text ?? "";
      return serializeNode(child, 0);
    })
    .join("")
    .trim();
}
