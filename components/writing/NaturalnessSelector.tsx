"use client";

import { useEffect, useRef, useState } from "react";
import {
  NATURALNESS_LEVELS,
  type NaturalnessLevel,
} from "@/lib/writing/types";

// Compact naturalness picker beside the writing-mode selector: controls how
// aggressively Wright reduces AI-typical prose patterns in generated fiction.
// Same interaction model as WritingModeSelector (upward listbox, keyboardable).

interface NaturalnessSelectorProps {
  level: NaturalnessLevel;
  onChange: (level: NaturalnessLevel) => void;
  disabled?: boolean;
}

export function NaturalnessSelector({
  level,
  onChange,
  disabled,
}: NaturalnessSelectorProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = NATURALNESS_LEVELS.find((l) => l.id === level)!;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const select = (next: NaturalnessLevel) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => (i + 1) % NATURALNESS_LEVELS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex(
        (i) => (i - 1 + NATURALNESS_LEVELS.length) % NATURALNESS_LEVELS.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(NATURALNESS_LEVELS[focusIndex].id);
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setFocusIndex(NATURALNESS_LEVELS.findIndex((l) => l.id === level));
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Naturalness: ${current.label}`}
        title={current.description}
        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-50"
      >
        <LeafIcon />
        {current.label}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Naturalness"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-80 rounded-panel border border-neutral-200 bg-white p-1 shadow-toast"
        >
          {NATURALNESS_LEVELS.map((l, i) => {
            const active = l.id === level;
            return (
              <li key={l.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => select(l.id)}
                  onMouseEnter={() => setFocusIndex(i)}
                  className={[
                    "w-full rounded-lg px-2.5 py-2 text-left",
                    i === focusIndex ? "bg-blue-50" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-800">
                    {l.label}
                    {active && <CheckIcon />}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
                    {l.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Toggle: "Ask questions when more context would improve the writing."
 * When off, Wright makes reasonable choices, generates immediately, and
 * never saves those choices as confirmed story facts.
 */
export function AskQuestionsToggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      aria-label="Ask questions when more context would improve the writing"
      title={
        enabled
          ? "Wright may pause to ask a question when more context would improve the writing. Click to disable."
          : "Wright generates immediately, making reasonable choices without asking. Click to enable questions."
      }
      className={[
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50",
        enabled
          ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300"
          : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "relative inline-flex h-3 w-[22px] items-center rounded-full transition-colors",
          enabled ? "bg-blue-600" : "bg-neutral-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-[10px]" : "translate-x-[2px]",
          ].join(" ")}
        />
      </span>
      Ask questions
    </button>
  );
}

function LeafIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
