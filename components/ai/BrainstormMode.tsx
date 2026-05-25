"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useAI } from "@/hooks/useAI";
import { StreamingResponse } from "./StreamingResponse";

interface BrainstormModeProps {
  editor: Editor | null;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function BrainstormMode({ editor, onToast }: BrainstormModeProps) {
  const { run, isStreaming, response } = useAI();
  const [prompt, setPrompt] = useState("");
  const [includeContext, setIncludeContext] = useState(false);

  const handleRun = async () => {
    if (!prompt.trim()) {
      onToast("Tell Claude what you're stuck on.", "info");
      return;
    }
    const cursorContext = includeContext ? getSurroundingParagraph(editor) : "";
    await run(
      {
        mode: "brainstorm",
        userPrompt: prompt,
        contextIncluded: includeContext,
        cursorContext,
      },
      {
        onError: () =>
          onToast("Claude couldn't respond — please try again.", "error"),
      }
    );
  };

  const insertAtCursor = () => {
    if (!editor || !response) return;
    const lines = response.split(/\n+/).filter((l) => l.trim().length > 0);
    const html = lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
    editor
      .chain()
      .focus()
      .insertContent(html)
      .run();
    onToast("Inserted into your document.", "success");
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="What are you trying to write about, or where are you stuck?"
        className="w-full bg-cream-100 border border-cream-300 rounded p-3 text-[15px] font-serif text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-amber-accent resize-none"
      />

      <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
        <input
          type="checkbox"
          checked={includeContext}
          onChange={(e) => setIncludeContext(e.target.checked)}
          className="accent-amber-accent"
        />
        Include surrounding paragraph
      </label>

      <button
        type="button"
        onClick={handleRun}
        disabled={isStreaming}
        className="w-full bg-amber-accent text-white rounded px-4 py-2.5 font-medium text-sm hover:opacity-90 disabled:opacity-50"
      >
        {isStreaming ? "Thinking…" : "Brainstorm with Claude →"}
      </button>

      <div className="mt-2 max-h-[50vh] overflow-auto">
        <StreamingResponse
          text={response}
          isStreaming={isStreaming}
          emptyHint="Claude's ideas will appear here."
        />
      </div>

      {response && !isStreaming && (
        <button
          type="button"
          onClick={insertAtCursor}
          className="mt-2 w-full bg-cream-100 border border-cream-300 text-ink-700 rounded px-4 py-2 text-sm hover:border-amber-accent"
        >
          Insert at cursor
        </button>
      )}
    </div>
  );
}

function getSurroundingParagraph(editor: Editor | null): string {
  if (!editor) return "";
  const { $from } = editor.state.selection;
  const node = $from.node($from.depth);
  return node?.textContent ?? "";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
