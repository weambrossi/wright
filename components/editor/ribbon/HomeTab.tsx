"use client";

import type { Editor } from "@tiptap/react";
import { Divider } from "./RibbonPrimitives";
import { StyleControls } from "./controls/StyleControls";
import { FontControls } from "./controls/FontControls";
import { ParagraphControls } from "./controls/ParagraphControls";
import { EditingControls } from "./controls/EditingControls";

export function HomeTab({
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
  return (
    <>
      <FontControls editor={editor} />
      <Divider />
      <ParagraphControls editor={editor} />
      <Divider />
      <StyleControls editor={editor} />
      <Divider />
      <EditingControls
        editor={editor}
        onOpenFind={onOpenFind}
        onOpenReplace={onOpenReplace}
        onToast={onToast}
      />
    </>
  );
}
