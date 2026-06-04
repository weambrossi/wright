"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { ContextStrip } from "@/components/ui/ContextStrip";
import { GrammarMode } from "./GrammarMode";
import { BrainstormMode } from "./BrainstormMode";
import { RewriteMode } from "./RewriteMode";
import { ContinueMode } from "./ContinueMode";

export type AIMode = "grammar" | "brainstorm" | "rewrite" | "continue";

interface AISidebarProps {
  editor: Editor | null;
  selectedText: string;
  thinking: boolean;
  initialMode?: AIMode;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

const TABS: { id: AIMode; label: string; icon: React.ReactNode }[] = [
  { id: "grammar", label: "Grammar & Style", icon: <CheckIcon /> },
  { id: "brainstorm", label: "Brainstorm", icon: <BulbIcon /> },
  { id: "rewrite", label: "Rewrite", icon: <PencilIcon /> },
  { id: "continue", label: "Continue Writing", icon: <ArrowIcon /> },
];

export function AISidebar({
  editor,
  selectedText,
  thinking,
  initialMode = "grammar",
  onToast,
}: AISidebarProps) {
  const [mode, setMode] = useState<AIMode>(initialMode);

  return (
    <div className="h-full flex flex-col bg-neutral-50 border-l border-neutral-300">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 pt-4 pb-3">
        <div className="text-[11px] tracking-[0.18em] uppercase text-neutral-500 font-medium">
          Wright AI
        </div>
        <div
          className={`w-2 h-2 rounded-full bg-blue-600 ${
            thinking ? "animate-breath" : "opacity-30"
          }`}
          aria-label={thinking ? "Thinking" : "Idle"}
        />
      </header>

      <div className="px-3 grid grid-cols-2 gap-2 py-3">
        {TABS.map((t) => {
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={[
                "flex items-center gap-1.5 text-xs rounded px-3 py-2 border text-left",
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-neutral-700 border-neutral-300 hover:border-blue-400",
              ].join(" ")}
            >
              <span className="opacity-80">{t.icon}</span>
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      <ContextStrip selectedText={selectedText} />

      <div className="flex-1 overflow-auto">
        {mode === "grammar" && <GrammarMode editor={editor} onToast={onToast} />}
        {mode === "brainstorm" && (
          <BrainstormMode editor={editor} onToast={onToast} />
        )}
        {mode === "rewrite" && (
          <RewriteMode
            editor={editor}
            selectedText={selectedText}
            onToast={onToast}
          />
        )}
        {mode === "continue" && (
          <ContinueMode editor={editor} onToast={onToast} />
        )}
      </div>
    </div>
  );
}

const sw = 1.6;
function svg(children: React.ReactNode) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function CheckIcon() { return svg(<polyline points="20 6 9 17 4 12" />); }
function BulbIcon() { return svg(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></>); }
function PencilIcon() { return svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></>); }
function ArrowIcon() { return svg(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>); }
