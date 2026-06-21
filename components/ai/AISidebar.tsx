"use client";

import type { Editor } from "@tiptap/react";
import { ChatMode, type AIAction } from "./ChatMode";

export type { AIAction };

interface AISidebarProps {
  editor: Editor | null;
  selectedText: string;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
  onClose?: () => void;
  closeDirection?: "right" | "down";
  // A ribbon AI tile was clicked — seeds the chat with that action.
  trigger?: { action: AIAction; nonce: number } | null;
}

export function AISidebar({
  editor,
  selectedText,
  onToast,
  onClose,
  closeDirection = "right",
  trigger,
}: AISidebarProps) {
  return (
    <div className="flex h-full flex-col border-l border-neutral-300 bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 pb-3 pt-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Wright AI
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close AI assistant"
            aria-label="Close AI assistant"
            className="grid h-7 w-7 place-items-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d={
                  closeDirection === "down"
                    ? "m6 9 6 6 6-6"
                    : "m9 18 6-6-6-6"
                }
              />
            </svg>
          </button>
        )}
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
