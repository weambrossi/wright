"use client";

import type { Editor } from "@tiptap/react";
import { ChatMode, type AIAction } from "./ChatMode";

export type { AIAction };

interface AISidebarProps {
  editor: Editor | null;
  selectedText: string;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
  // A ribbon AI tile was clicked — seeds the chat with that action.
  trigger?: { action: AIAction; nonce: number } | null;
}

export function AISidebar({
  editor,
  selectedText,
  onToast,
  trigger,
}: AISidebarProps) {
  return (
    <div className="flex h-full flex-col border-l border-neutral-300 bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 pb-3 pt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Wright AI
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ChatMode
          editor={editor}
          selectedText={selectedText}
          onToast={onToast}
          trigger={trigger}
        />
      </div>
    </div>
  );
}
