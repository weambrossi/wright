"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useAI } from "@/hooks/useAI";
import { IssueCard, GrammarIssue } from "./IssueCard";

interface GrammarModeProps {
  editor: Editor | null;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}

export function GrammarMode({ editor, onToast }: GrammarModeProps) {
  const { run, isStreaming } = useAI();
  const [issues, setIssues] = useState<GrammarIssue[]>([]);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [ranOnce, setRanOnce] = useState(false);
  const [rawResponse, setRawResponse] = useState("");

  const check = async () => {
    if (!editor) return;
    const documentContent = editor.getText();
    if (!documentContent.trim()) {
      onToast("There's nothing to check yet.", "info");
      return;
    }
    setIssues([]);
    setApplied(new Set());
    setDismissed(new Set());
    setRanOnce(true);
    setRawResponse("");

    const result = await run(
      { mode: "grammar", documentContent },
      {
        onDone: (final) => {
          setRawResponse(final);
          try {
            const cleaned = extractJsonArray(final);
            const parsed = JSON.parse(cleaned) as GrammarIssue[];
            const safe = parsed.filter(
              (i) =>
                typeof i?.originalPhrase === "string" &&
                typeof i?.suggestedFix === "string"
            );
            setIssues(safe);
          } catch {
            onToast(
              "Claude returned a response I couldn't parse. Try again?",
              "error"
            );
          }
        },
        onError: () => onToast("Claude couldn't respond — please try again.", "error"),
      }
    );
    return result;
  };

  const apply = (idx: number) => {
    if (!editor) return;
    const issue = issues[idx];
    const html = editor.getHTML();
    const replaced = replaceFirst(html, issue.originalPhrase, issue.suggestedFix);
    if (replaced === html) {
      onToast("Couldn't find that phrase in the document.", "error");
      return;
    }
    editor.commands.setContent(replaced, false);
    setApplied((prev) => new Set(prev).add(idx));
  };

  const dismiss = (idx: number) => {
    setDismissed((prev) => new Set(prev).add(idx));
  };

  const visibleIssues = issues
    .map((issue, idx) => ({ issue, idx }))
    .filter(({ idx }) => !dismissed.has(idx));

  return (
    <div className="flex flex-col gap-4 p-3">
      <button
        type="button"
        onClick={check}
        disabled={isStreaming}
        className="w-full bg-blue-600 text-white rounded px-4 py-2.5 font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {isStreaming ? "Thinking…" : "Check Grammar & Style"}
      </button>

      {isStreaming && (
        <div className="space-y-2">
          <div className="shimmer-row w-[80%]" />
          <div className="shimmer-row w-[60%]" />
          <div className="shimmer-row w-[70%]" />
        </div>
      )}

      {!isStreaming && ranOnce && issues.length === 0 && rawResponse && (
        <EmptyAllClear />
      )}

      {!isStreaming && visibleIssues.length === 0 && issues.length > 0 && (
        <EmptyAllClear />
      )}

      {visibleIssues.length > 0 && (
        <>
          <div className="text-sm text-neutral-600">
            Found {visibleIssues.length} suggestion
            {visibleIssues.length === 1 ? "" : "s"} in your document.
          </div>
          <div className="flex flex-col gap-3">
            {visibleIssues.map(({ issue, idx }) => (
              <IssueCard
                key={idx}
                issue={issue}
                applied={applied.has(idx)}
                onApply={() => apply(idx)}
                onDismiss={() => dismiss(idx)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyAllClear() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
      <div className="w-10 h-10 rounded-full bg-green-50 grid place-items-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="text-neutral-500 text-sm">
        Your writing looks great.
      </div>
    </div>
  );
}

function extractJsonArray(s: string): string {
  // Strip code fences and surrounding text
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : s;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return candidate.trim();
  return candidate.slice(start, end + 1);
}

function replaceFirst(html: string, needle: string, replacement: string): string {
  if (!needle) return html;
  // Try direct match first.
  const idx = html.indexOf(needle);
  if (idx !== -1) {
    return html.slice(0, idx) + escapeHtml(replacement) + html.slice(idx + needle.length);
  }
  // Fallback: strip tags, search in text content.
  const textIdx = textIndexOf(html, needle);
  if (textIdx === -1) return html;
  return spliceAtTextIndex(html, textIdx, needle.length, escapeHtml(replacement));
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Walks the HTML treating tags as zero-length, finds where the text needle starts.
function textIndexOf(html: string, needle: string): number {
  let text = "";
  const map: number[] = []; // map[textIdx] = htmlIdx
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    map.push(i);
    text += html[i];
    i++;
  }
  const t = text.indexOf(needle);
  if (t === -1) return -1;
  return map[t];
}

function spliceAtTextIndex(
  html: string,
  htmlStart: number,
  textLen: number,
  replacement: string
): string {
  // Walk forward from htmlStart counting text chars (skipping tags) until textLen.
  let remaining = textLen;
  let i = htmlStart;
  while (i < html.length && remaining > 0) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    i++;
    remaining--;
  }
  return html.slice(0, htmlStart) + replacement + html.slice(i);
}
