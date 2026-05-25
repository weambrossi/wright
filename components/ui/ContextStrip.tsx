"use client";

interface ContextStripProps {
  selectedText: string;
}

export function ContextStrip({ selectedText }: ContextStripProps) {
  if (!selectedText) return null;
  const preview =
    selectedText.length > 140
      ? selectedText.slice(0, 140).trim() + "…"
      : selectedText;

  return (
    <div className="mx-3 my-2 bg-amber-light border-l-[3px] border-amber-accent text-ink-700 rounded px-3 py-2 text-xs">
      <div className="font-medium flex items-center gap-1.5">
        <span className="text-amber-accent">✦</span>
        Working with selected text
      </div>
      <div className="mt-1 line-clamp-2 italic text-ink-700/90 font-serif">
        “{preview}”
      </div>
    </div>
  );
}
