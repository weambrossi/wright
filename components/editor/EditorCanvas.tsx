"use client";

import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";

interface EditorCanvasProps {
  editor: Editor | null;
  title: string;
  onTitleChange: (next: string) => void;
}

export function EditorCanvas({
  editor,
  title,
  onTitleChange,
}: EditorCanvasProps) {
  return (
    <div className="flex-1 overflow-auto bg-cream-50">
      <div className="max-w-[720px] mx-auto my-10 bg-cream-100 rounded-panel shadow-paper px-20 py-16">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          spellCheck={false}
          className="w-full bg-transparent border-none outline-none font-serif text-3xl font-semibold text-ink-900 placeholder:text-ink-300 mb-6"
          placeholder="Untitled Document"
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
