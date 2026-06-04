"use client";

import type { Editor } from "@tiptap/react";
import { Group, Row, RibbonButton } from "../RibbonPrimitives";
import {
  Undo,
  Redo,
  Cut,
  Copy,
  Paste,
  SelectAll,
  Search,
  Replace,
} from "../icons";

export function EditingControls({
  editor,
  onOpenFind,
  onOpenReplace,
  onToast,
}: {
  editor: Editor;
  onOpenFind: () => void;
  onOpenReplace: () => void;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}) {
  const copy = (cut: boolean) => {
    editor.commands.focus();
    const ok = document.execCommand(cut ? "cut" : "copy");
    if (!ok) onToast("Use Ctrl/Cmd+C to copy in this browser.", "info");
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {
      onToast("Use Ctrl/Cmd+V to paste in this browser.", "info");
    }
  };

  return (
    <Group label="Editing">
      <div className="flex flex-col gap-1">
        <Row>
          <RibbonButton
            title="Undo (Ctrl+Z)"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo />
          </RibbonButton>
          <RibbonButton
            title="Redo (Ctrl+Y)"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo />
          </RibbonButton>
          <RibbonButton title="Cut" onClick={() => copy(true)}>
            <Cut />
          </RibbonButton>
          <RibbonButton title="Copy" onClick={() => copy(false)}>
            <Copy />
          </RibbonButton>
        </Row>
        <Row>
          <RibbonButton title="Paste" onClick={paste}>
            <Paste />
          </RibbonButton>
          <RibbonButton
            title="Select all (Ctrl+A)"
            onClick={() => editor.chain().focus().selectAll().run()}
          >
            <SelectAll />
          </RibbonButton>
          <RibbonButton title="Find" onClick={onOpenFind}>
            <Search />
          </RibbonButton>
          <RibbonButton title="Replace" onClick={onOpenReplace}>
            <Replace />
          </RibbonButton>
        </Row>
      </div>
    </Group>
  );
}
