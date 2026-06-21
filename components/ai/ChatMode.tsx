"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useAI } from "@/hooks/useAI";
import type { ChatMessage } from "@/lib/prompts";
import { editorJsonToAIText } from "@/lib/document/serializeForAI";
import { Markdown } from "./Markdown";

export type AIAction = "grammar" | "brainstorm" | "rewrite" | "continue";

interface ChatModeProps {
  editor: Editor | null;
  selectedText: string;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
  // A click on one of the ribbon AI tiles, with a nonce so repeat clicks re-fire.
  trigger?: { action: AIAction; nonce: number } | null;
  layout?: "sidebar" | "full";
}

interface ActionDef {
  id: AIAction;
  label: string;
  // If true, the action needs highlighted text in the document.
  needsSelection?: boolean;
  // Whether selected text (when present) should ride along as attached context.
  attachSelection?: boolean;
  // The editable starter dropped into the composer. `hasSelection` lets the
  // wording adapt to whether a passage is attached.
  starter: (hasSelection: boolean) => string;
}

const ACTIONS: ActionDef[] = [
  {
    id: "grammar",
    label: "Grammar & style",
    attachSelection: true,
    starter: (has) =>
      has
        ? "Check the grammar and style of this passage and suggest fixes. "
        : "Check my whole draft for grammar, style, clarity, and flow, and show me your suggested fixes. ",
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    starter: () => "I'd like to brainstorm. I'm thinking about ",
  },
  {
    id: "rewrite",
    label: "Rewrite",
    needsSelection: true,
    attachSelection: true,
    starter: () => "Rewrite this passage — ",
  },
  {
    id: "continue",
    label: "Continue writing",
    starter: () =>
      "Continue writing from where I left off, matching my voice and pacing. ",
  },
];

const GREETING =
  "Hi — I'm Wright, your writing partner. Tell me what you're working on, or tap one of the buttons above to get started. When you highlight text first, those buttons bring it into our conversation so you can tell me exactly what you want.";

export function ChatMode({
  editor,
  selectedText,
  onToast,
  trigger,
  layout = "sidebar",
}: ChatModeProps) {
  const isFull = layout === "full";
  const { run, isStreaming } = useAI();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // Text pulled from the document to send along as context with the next message.
  const [attachment, setAttachment] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the latest message in view as it streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const applyAction = (action: AIAction) => {
    const def = ACTIONS.find((a) => a.id === action);
    if (!def) return;

    const selection = selectedText.trim();
    if (def.needsSelection && !selection) {
      onToast("Select some text in your document first.", "info");
      return;
    }

    const attach = def.attachSelection && selection ? selection : null;
    setAttachment(attach);
    setInput(def.starter(Boolean(attach)));

    // Focus the composer and drop the cursor at the end so they can keep typing.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    });
  };

  // Fire the action requested from the ribbon (re-fires on each click via nonce).
  useEffect(() => {
    if (trigger) applyAction(trigger.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.nonce]);

  const send = async () => {
    const typed = input.trim();
    if ((!typed && !attachment) || isStreaming) return;

    const content = attachment
      ? `${typed}\n\n"""\n${attachment}\n"""`
      : typed;

    const history = [...messages, { role: "user" as const, content }];
    // Add the user turn plus an empty assistant turn we stream into.
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setAttachment(null);

    const documentContent = editor ? editorJsonToAIText(editor.getJSON()) : "";

    await run(
      {
        mode: "chat",
        messages: history,
        documentContent,
      },
      {
        onChunk: (_chunk, accumulated) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: accumulated };
            return next;
          });
        },
        onError: () => {
          onToast("Wright couldn't respond — please try again.", "error");
          setMessages((prev) => {
            const next = [...prev];
            if (next[next.length - 1]?.content === "") next.pop();
            return next;
          });
        },
      }
    );
  };

  const insertIntoDoc = (text: string) => {
    if (!editor || !text.trim()) return;
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
      .join("");
    editor.chain().focus().insertContent(paragraphs).run();
    onToast("Inserted into your document.", "success");
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    setAttachment(null);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Actions — the four tools live above the chat and feed into it */}
      <div
        className={[
          "border-b border-neutral-200",
          isFull ? "px-4 py-3" : "px-3 py-2.5",
        ].join(" ")}
      >
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          Quick actions
        </div>
        <div
          className={
            isFull
              ? "flex flex-wrap gap-2"
              : "grid grid-cols-2 gap-1.5"
          }
        >
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => applyAction(a.id)}
              disabled={isStreaming}
              className={[
                "rounded border border-neutral-300 bg-white text-neutral-700 hover:border-blue-400 hover:text-blue-700 disabled:opacity-50",
                isFull
                  ? "px-3.5 py-2 text-sm"
                  : "px-2.5 py-1.5 text-left text-xs",
              ].join(" ")}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className={[
          "flex-1 overflow-auto py-3",
          isFull ? "px-4" : "px-3",
        ].join(" ")}
      >
        {messages.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-neutral-600">
            {GREETING}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const streamingThis =
                isStreaming && i === messages.length - 1 && !isUser;
              return (
                <div
                  key={i}
                  className={isUser ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={[
                      "rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                      isFull ? "max-w-[85%]" : "max-w-[92%]",
                      isUser
                        ? "whitespace-pre-wrap rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm border border-neutral-200 bg-white text-neutral-800",
                    ].join(" ")}
                  >
                    {isUser ? m.content : <Markdown text={m.content} />}
                    {streamingThis && (
                      <span className="ml-0.5 inline-block h-[14px] w-[6px] animate-breath bg-blue-600 align-middle" />
                    )}
                    {!isUser && m.content && !streamingThis && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => insertIntoDoc(m.content)}
                          className="text-[11px] text-blue-600 hover:text-blue-800"
                        >
                          Insert into document
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        className={[
          "border-t border-neutral-200 bg-white",
          isFull ? "p-4" : "p-2.5",
        ].join(" ")}
      >
        {messages.length > 0 && (
          <div className="mb-1.5 flex justify-end">
            <button
              type="button"
              onClick={clearChat}
              className="text-[11px] text-neutral-400 hover:text-neutral-600"
            >
              New conversation
            </button>
          </div>
        )}

        {attachment && (
          <div className="mb-1.5 flex items-start gap-2 rounded border-l-[3px] border-blue-600 bg-blue-50 px-2.5 py-1.5 text-xs text-neutral-600">
            <span className="mt-[1px] text-blue-600">✦</span>
            <span className="line-clamp-2 flex-1">“{attachment}”</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="shrink-0 text-neutral-400 hover:text-neutral-700"
              aria-label="Remove attached text"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={isFull ? 3 : 2}
            placeholder="Talk to Wright about your writing…"
            className="flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={isStreaming || (!input.trim() && !attachment)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
