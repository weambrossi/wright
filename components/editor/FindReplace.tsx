"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

interface Match {
  from: number;
  to: number;
}

/** Collect every match of `query` across the document's text nodes. */
function findMatches(editor: Editor, query: string): Match[] {
  if (!query) return [];
  const matches: Match[] = [];
  const needle = query.toLowerCase();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const haystack = node.text.toLowerCase();
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + query.length });
      index = haystack.indexOf(needle, index + needle.length);
    }
  });
  return matches;
}

export function FindReplace({
  editor,
  mode,
  onClose,
}: {
  editor: Editor;
  mode: "find" | "replace";
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [current, setCurrent] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => findMatches(editor, query),
    // Recompute as the query changes; editor mutations also re-render the toolbar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    setCurrent(0);
  }, [query]);

  const goTo = (idx: number) => {
    if (matches.length === 0) return;
    const wrapped = (idx + matches.length) % matches.length;
    setCurrent(wrapped);
    const m = matches[wrapped];
    editor
      .chain()
      .setTextSelection({ from: m.from, to: m.to })
      .scrollIntoView()
      .run();
  };

  const findNext = () => goTo(current + 1);
  const findPrev = () => goTo(current - 1);

  const replaceOne = () => {
    if (matches.length === 0) return;
    const m = matches[Math.min(current, matches.length - 1)];
    editor
      .chain()
      .focus()
      .insertContentAt({ from: m.from, to: m.to }, replacement)
      .run();
  };

  const replaceAll = () => {
    if (matches.length === 0) return;
    // Replace from the end so earlier positions stay valid.
    const chain = editor.chain().focus();
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      chain.insertContentAt({ from: m.from, to: m.to }, replacement);
    }
    chain.run();
  };

  return (
    <div className="absolute right-6 top-3 z-30 w-[320px] rounded-md border border-neutral-300 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-600">
          {mode === "replace" ? "Find and replace" : "Find"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-5 w-5 place-items-center rounded text-neutral-500 hover:bg-neutral-100"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.shiftKey ? findPrev() : findNext();
            }
          }}
          placeholder="Find"
          className="h-8 flex-1 rounded border border-neutral-300 px-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-neutral-500">
          {matches.length ? `${current + 1}/${matches.length}` : "0/0"}
        </span>
      </div>

      <div className="mt-1 flex gap-1">
        <button
          type="button"
          onClick={findPrev}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={findNext}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
        >
          Next
        </button>
      </div>

      {mode === "replace" && (
        <>
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with"
            className="mt-2 h-8 w-full rounded border border-neutral-300 px-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={replaceOne}
              className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={replaceAll}
              className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
            >
              Replace all
            </button>
          </div>
        </>
      )}
    </div>
  );
}
