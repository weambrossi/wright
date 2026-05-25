"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useAI } from "@/hooks/useAI";
import type { ContinueTone } from "@/lib/prompts";

interface ContinueModeProps {
  editor: Editor | null;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

const TONES: ContinueTone[] = [
  "Match my style",
  "More descriptive",
  "More concise",
  "More dialogue",
];

export function ContinueMode({ editor, onToast }: ContinueModeProps) {
  const { run, isStreaming } = useAI();
  const [from, setFrom] = useState<"cursor" | "end">("cursor");
  const [tone, setTone] = useState<ContinueTone>("Match my style");
  const [inserted, setInserted] = useState(false);
  const insertedRangeRef = useRef<{ from: number; to: number } | null>(null);

  const handleRun = async () => {
    if (!editor) return;
    const documentContent = editor.getText();
    if (!documentContent.trim()) {
      onToast("Write something first so Claude has context.", "info");
      return;
    }

    // position the cursor for insertion
    if (from === "end") {
      editor.commands.focus("end");
    } else {
      editor.commands.focus();
    }

    const insertStart = editor.state.selection.from;
    insertedRangeRef.current = { from: insertStart, to: insertStart };

    let totalInserted = 0;
    setInserted(false);

    await run(
      {
        mode: "continue",
        documentContent,
        continueFrom: from,
        tone,
      },
      {
        onChunk: (chunk) => {
          if (!editor) return;
          editor
            .chain()
            .insertContentAt(insertStart + totalInserted, chunk)
            .run();
          totalInserted += chunk.length;
          if (insertedRangeRef.current) {
            insertedRangeRef.current.to = insertStart + totalInserted;
          }
        },
        onDone: () => {
          setInserted(true);
        },
        onError: () => {
          onToast("Claude couldn't respond — please try again.", "error");
        },
      }
    );
  };

  const undoInsert = () => {
    if (!editor || !insertedRangeRef.current) return;
    const { from: a, to: b } = insertedRangeRef.current;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: a, to: b })
      .deleteSelection()
      .run();
    setInserted(false);
    insertedRangeRef.current = null;
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex gap-2">
        {(["cursor", "end"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setFrom(opt)}
            className={[
              "flex-1 text-xs rounded-full px-3 py-1.5 border",
              from === opt
                ? "bg-amber-accent text-white border-amber-accent"
                : "bg-cream-100 text-ink-700 border-cream-300 hover:border-amber-accent",
            ].join(" ")}
          >
            {opt === "cursor" ? "Continue from cursor" : "Continue from end"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-ink-500">
          Tone
        </label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as ContinueTone)}
          className="bg-cream-100 border border-cream-300 rounded px-2 py-1.5 text-sm text-ink-700 focus:outline-none focus:border-amber-accent"
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isStreaming}
        className="w-full bg-amber-accent text-white rounded px-4 py-2.5 font-medium text-sm hover:opacity-90 disabled:opacity-50"
      >
        {isStreaming ? "Writing…" : "Continue Writing →"}
      </button>

      {isStreaming && (
        <div className="space-y-2 mt-1">
          <div className="shimmer-row w-[85%]" />
          <div className="shimmer-row w-[65%]" />
        </div>
      )}

      {inserted && !isStreaming && (
        <button
          type="button"
          onClick={undoInsert}
          className="w-full bg-cream-100 border border-cream-300 text-ink-700 rounded px-4 py-2 text-sm hover:border-amber-accent"
        >
          Undo continuation
        </button>
      )}
    </div>
  );
}
