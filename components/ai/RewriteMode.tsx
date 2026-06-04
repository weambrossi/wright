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
      <div className="p-4 text-sm text-neutral-500">
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
        className="w-full bg-white border border-neutral-300 rounded p-3 text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 resize-none"
      />

      <button
        type="button"
        onClick={handleRun}
        disabled={isStreaming}
        className="w-full bg-blue-600 text-white rounded px-4 py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {isStreaming ? "Thinking…" : "Rewrite Selection →"}
      </button>

      {(response || isStreaming) && (
        <div className="grid grid-cols-1 gap-3 mt-2">
          <div className="bg-neutral-50 rounded p-3 border border-neutral-200">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
              Original
            </div>
            <div className="text-[14px] text-neutral-500 leading-relaxed whitespace-pre-wrap">
              {selectedText}
            </div>
          </div>
          <div className="bg-blue-50/50 rounded p-3 border border-blue-300">
            <div className="text-[10px] uppercase tracking-wider text-blue-700 mb-1">
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
            className="flex-1 bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleRun}
            className="px-3 py-2 text-sm text-neutral-700 rounded border border-neutral-300 hover:bg-neutral-100"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
