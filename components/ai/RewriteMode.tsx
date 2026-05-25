"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useAI } from "@/hooks/useAI";
import { StreamingResponse } from "./StreamingResponse";

interface RewriteModeProps {
  editor: Editor | null;
  selectedText: string;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function RewriteMode({ editor, selectedText, onToast }: RewriteModeProps) {
  const { run, isStreaming, response } = useAI();
  const [instruction, setInstruction] = useState("");
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);

  const handleRun = async () => {
    if (!editor) return;
    if (!selectedText) {
      onToast("Select some text in your document first.", "info");
      return;
    }
    if (!instruction.trim()) {
      onToast("Tell Claude how to rewrite it.", "info");
      return;
    }
    const { from, to } = editor.state.selection;
    setSavedSelection({ from, to });
    await run(
      {
        mode: "rewrite",
        selectedText,
        instruction,
      },
      {
        onError: () =>
          onToast("Claude couldn't respond — please try again.", "error"),
      }
    );
  };

  const accept = () => {
    if (!editor || !response || !savedSelection) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: savedSelection.from, to: savedSelection.to })
      .insertContent(response.trim())
      .run();
    onToast("Rewrite applied.", "success");
    setSavedSelection(null);
  };

  if (!selectedText) {
    return (
      <div className="p-4 text-sm text-ink-500 font-serif italic">
        Select some text in your document first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={3}
        placeholder="e.g. Make this more concise / more literary / less formal"
        className="w-full bg-cream-100 border border-cream-300 rounded p-3 text-[14px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-amber-accent resize-none"
      />

      <button
        type="button"
        onClick={handleRun}
        disabled={isStreaming}
        className="w-full bg-amber-accent text-white rounded px-4 py-2.5 font-medium text-sm hover:opacity-90 disabled:opacity-50"
      >
        {isStreaming ? "Thinking…" : "Rewrite Selection →"}
      </button>

      {(response || isStreaming) && (
        <div className="grid grid-cols-1 gap-3 mt-2">
          <div className="bg-cream-100 rounded p-3 border border-cream-300">
            <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">
              Original
            </div>
            <div className="font-serif text-[14px] text-ink-500 leading-relaxed whitespace-pre-wrap">
              {selectedText}
            </div>
          </div>
          <div className="bg-cream-50 rounded p-3 border border-amber-accent/40">
            <div className="text-[10px] uppercase tracking-wider text-amber-accent mb-1">
              Rewrite
            </div>
            <StreamingResponse text={response} isStreaming={isStreaming} />
          </div>
        </div>
      )}

      {response && !isStreaming && (
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={accept}
            className="flex-1 bg-amber-accent text-white rounded px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="px-3 py-2 text-sm text-ink-700 rounded border border-cream-300 hover:border-amber-accent"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
