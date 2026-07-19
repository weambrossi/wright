"use client";

import type { Editor } from "@tiptap/react";
import { ChatMode, type AIAction } from "./ChatMode";
import type { AIChatSession } from "@/hooks/useAIChatSession";

interface AIChatViewProps {
  editor: Editor | null;
  selectedText: string;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
  session: AIChatSession;
  trigger?: { action: AIAction; nonce: number } | null;
  onOpenStoryContext?: () => void;
}

export function AIChatView({
  editor,
  selectedText,
  onToast,
  session,
  trigger,
  onOpenStoryContext,
}: AIChatViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-50">
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            Wright AI
          </div>
          {onOpenStoryContext && (
            <button
              type="button"
              onClick={onOpenStoryContext}
              className="rounded border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100"
            >
              Story context
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <ChatMode
          editor={editor}
          selectedText={selectedText}
          onToast={onToast}
          session={session}
          trigger={trigger}
          layout="full"
        />
      </div>
    </div>
  );
}
