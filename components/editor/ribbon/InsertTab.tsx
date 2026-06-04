"use client";

import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import { Group, RibbonTile } from "./RibbonPrimitives";
import {
  ImageIcon,
  TableIcon,
  LinkIcon,
  HrIcon,
  PageBreakIcon,
  ClockIcon,
} from "./icons";

export function InsertTab({
  editor,
  onToast,
}: {
  editor: Editor;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const insertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result as string })
        .run();
    };
    reader.readAsDataURL(file);
  };

  const insertLink = () => {
    const previous = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Link URL", previous);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${href}">${href}</a> `)
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  };

  const insertDateTime = () => {
    const now = new Date().toLocaleString(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    });
    editor.chain().focus().insertContent(now).run();
  };

  return (
    <>
      <Group label="Media">
        <RibbonTile
          title="Insert an image from your computer"
          label="Image"
          icon={<ImageIcon />}
          onClick={() => fileRef.current?.click()}
        />
        <RibbonTile
          title="Insert a 3×3 table"
          label="Table"
          icon={<TableIcon />}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        />
      </Group>
      <div className="mx-1 h-12 w-px shrink-0 self-center bg-neutral-200" />
      <Group label="Links">
        <RibbonTile
          title="Insert or edit a hyperlink"
          label="Link"
          icon={<LinkIcon />}
          onClick={insertLink}
        />
      </Group>
      <div className="mx-1 h-12 w-px shrink-0 self-center bg-neutral-200" />
      <Group label="Elements">
        <RibbonTile
          title="Insert a horizontal line"
          label="Line"
          icon={<HrIcon />}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
        <RibbonTile
          title="Insert a page break"
          label="Page Break"
          icon={<PageBreakIcon />}
          onClick={() => editor.chain().focus().insertPageBreak().run()}
        />
        <RibbonTile
          title="Insert the current date and time"
          label="Date & Time"
          icon={<ClockIcon />}
          onClick={insertDateTime}
        />
      </Group>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) insertImageFile(file);
        }}
      />
    </>
  );
}
