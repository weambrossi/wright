"use client";

import type { Editor } from "@tiptap/react";
import { Group, Row, RibbonButton, RibbonSelect } from "../RibbonPrimitives";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  BulletList,
  OrderedList,
  Indent,
  Outdent,
} from "../icons";

const LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "2.5"];
const SPACING = [
  { label: "None", value: "0px" },
  { label: "Small", value: "8px" },
  { label: "Medium", value: "16px" },
  { label: "Large", value: "24px" },
];

export function ParagraphControls({ editor }: { editor: Editor }) {
  const blockType = editor.isActive("heading") ? "heading" : "paragraph";
  const currentLineHeight = editor.getAttributes(blockType).lineHeight ?? "";

  const indent = () => {
    if (editor.isActive("listItem")) {
      editor.chain().focus().sinkListItem("listItem").run();
    } else {
      editor.chain().focus().indentBlock().run();
    }
  };
  const outdent = () => {
    if (editor.isActive("listItem")) {
      editor.chain().focus().liftListItem("listItem").run();
    } else {
      editor.chain().focus().outdentBlock().run();
    }
  };

  return (
    <Group label="Paragraph">
      <div className="flex flex-col gap-1">
        <Row>
          <RibbonButton
            title="Align left"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft />
          </RibbonButton>
          <RibbonButton
            title="Align center"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter />
          </RibbonButton>
          <RibbonButton
            title="Align right"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight />
          </RibbonButton>
          <RibbonButton
            title="Justify"
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify />
          </RibbonButton>
        </Row>
        <Row>
          <RibbonButton
            title="Bulleted list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <BulletList />
          </RibbonButton>
          <RibbonButton
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <OrderedList />
          </RibbonButton>
          <RibbonButton title="Decrease indent" onClick={outdent}>
            <Outdent />
          </RibbonButton>
          <RibbonButton title="Increase indent" onClick={indent}>
            <Indent />
          </RibbonButton>
          <RibbonSelect
            title="Line spacing"
            width={52}
            value={currentLineHeight}
            onChange={(v) => editor.chain().focus().setLineHeight(v).run()}
          >
            <option value="">↕</option>
            {LINE_HEIGHTS.map((lh) => (
              <option key={lh} value={lh}>
                {lh}
              </option>
            ))}
          </RibbonSelect>
          <RibbonSelect
            title="Paragraph spacing"
            width={72}
            value=""
            onChange={(v) =>
              editor.chain().focus().setParagraphSpacing(v).run()
            }
          >
            <option value="">Spacing</option>
            {SPACING.map((s) => (
              <option key={s.label} value={s.value}>
                {s.label}
              </option>
            ))}
          </RibbonSelect>
        </Row>
      </div>
    </Group>
  );
}
