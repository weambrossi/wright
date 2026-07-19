"use client";

import { useEffect, useRef, useState } from "react";
import {
  WRITING_CONTROL_MODES,
  type WritingControlMode,
} from "@/lib/writing/types";

// Compact mode picker beside the chat input, in the spirit of a model
// selector: a small trigger showing the current mode, opening an upward menu
// with descriptions. Fully keyboard-navigable.

interface WritingModeSelectorProps {
  mode: WritingControlMode;
  onChange: (mode: WritingControlMode) => void;
  disabled?: boolean;
}

export function WritingModeSelector({
  mode,
  onChange,
  disabled,
}: WritingModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = WRITING_CONTROL_MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const select = (next: WritingControlMode) => {
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
      setFocusIndex((i) => (i + 1) % WRITING_CONTROL_MODES.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex(
        (i) => (i - 1 + WRITING_CONTROL_MODES.length) % WRITING_CONTROL_MODES.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(WRITING_CONTROL_MODES[focusIndex].id);
    }
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setFocusIndex(WRITING_CONTROL_MODES.findIndex((m) => m.id === mode));
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Writing mode: ${current.label}`}
        title={current.description}
        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-50"
      >
        <PenIcon />
        {current.label}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Writing mode"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-72 rounded-panel border border-neutral-200 bg-white p-1 shadow-toast"
        >
          {WRITING_CONTROL_MODES.map((m, i) => {
            const active = m.id === mode;
            return (
              <li key={m.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => select(m.id)}
                  onMouseEnter={() => setFocusIndex(i)}
                  className={[
                    "w-full rounded-lg px-2.5 py-2 text-left",
                    i === focusIndex ? "bg-blue-50" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-800">
                    {m.label}
                    {active && <CheckIcon />}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">
                    {m.description}
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

function PenIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
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
