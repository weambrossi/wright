"use client";

import type { Editor } from "@tiptap/react";
import type { Level } from "@tiptap/extension-heading";
import { Group, RibbonSelect } from "../RibbonPrimitives";

// Word/Docs style names mapped onto heading levels + blockquote. Title/Subtitle
// use h1/h2 so true content headings start at "Heading 1" -> h3.
const HEADING_LEVEL: Record<string, Level> = {
  title: 1,
  subtitle: 2,
  h1: 3,
  h2: 4,
  h3: 5,
};

const OPTIONS = [
  { value: "normal", label: "Normal text" },
  { value: "title", label: "Title" },
  { value: "subtitle", label: "Subtitle" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "quote", label: "Quote" },
];

function currentStyle(editor: Editor): string {
  if (editor.isActive("blockquote")) return "quote";
  for (const [name, level] of Object.entries(HEADING_LEVEL)) {
    if (editor.isActive("heading", { level })) return name;
  }
  return "normal";
}

export function StyleControls({ editor }: { editor: Editor }) {
  const applyStyle = (value: string) => {
    const chain = editor.chain().focus();
    // Unwrap an existing quote before applying a different block style.
    if (editor.isActive("blockquote") && value !== "quote") {
      chain.toggleBlockquote();
    }
    if (value === "normal") {
      chain.setParagraph().run();
    } else if (value === "quote") {
      if (!editor.isActive("blockquote")) chain.toggleBlockquote().run();
      else chain.run();
    } else {
      chain.setHeading({ level: HEADING_LEVEL[value] }).run();
    }
  };

  return (
    <Group label="Styles">
      <RibbonSelect
        title="Paragraph style"
        width={120}
        value={currentStyle(editor)}
        onChange={applyStyle}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </RibbonSelect>
    </Group>
  );
}
