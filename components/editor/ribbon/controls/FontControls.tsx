"use client";

import type { Editor } from "@tiptap/react";
import {
  Group,
  Row,
  RibbonButton,
  RibbonSelect,
  ColorPicker,
} from "../RibbonPrimitives";
import {
  BoldGlyph,
  ItalicGlyph,
  UnderlineGlyph,
  StrikeGlyph,
  TextColor,
  Highlighter,
  ClearFormat,
} from "../icons";

const FONTS = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Lora", value: "var(--font-lora), Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
];

const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export function FontControls({ editor }: { editor: Editor }) {
  const currentFont = editor.getAttributes("textStyle").fontFamily ?? "";
  const currentSize = (editor.getAttributes("textStyle").fontSize ?? "").replace(
    "px",
    ""
  );

  return (
    <Group label="Font">
      <div className="flex flex-col gap-1">
        <Row>
          <RibbonSelect
            title="Font family"
            width={132}
            value={currentFont}
            onChange={(v) => {
              if (v) editor.chain().focus().setFontFamily(v).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
          >
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </RibbonSelect>
          <RibbonSelect
            title="Font size"
            width={56}
            value={currentSize}
            onChange={(v) => {
              if (v) editor.chain().focus().setFontSize(`${v}px`).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
          >
            <option value="">–</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </RibbonSelect>
        </Row>
        <Row>
          <RibbonButton
            title="Bold (Ctrl+B)"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldGlyph />
          </RibbonButton>
          <RibbonButton
            title="Italic (Ctrl+I)"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicGlyph />
          </RibbonButton>
          <RibbonButton
            title="Underline (Ctrl+U)"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineGlyph />
          </RibbonButton>
          <RibbonButton
            title="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <StrikeGlyph />
          </RibbonButton>
          <ColorPicker
            title="Text color"
            icon={<TextColor />}
            onPick={(c) => editor.chain().focus().setColor(c).run()}
            onClear={() => editor.chain().focus().unsetColor().run()}
            clearLabel="Automatic"
          />
          <ColorPicker
            title="Highlight color"
            icon={<Highlighter />}
            onPick={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
            onClear={() => editor.chain().focus().unsetHighlight().run()}
            clearLabel="No color"
          />
          <RibbonButton
            title="Clear formatting"
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            <ClearFormat />
          </RibbonButton>
        </Row>
      </div>
    </Group>
  );
}
