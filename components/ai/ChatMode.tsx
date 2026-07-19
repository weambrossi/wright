"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  CHAT_ACTIONS,
  DEFAULT_CHAT_PLACEHOLDER,
  type AIAction,
  type AIChatSession,
  type ChatFileAttachment,
} from "@/hooks/useAIChatSession";
import { Markdown } from "./Markdown";
import { ChatStreamCursor, ChatTypingIndicator } from "./ChatTypingIndicator";
import { ClarificationPanel } from "@/components/writing/ClarificationPanel";
import { WritingModeSelector } from "@/components/writing/WritingModeSelector";
import {
  AskQuestionsToggle,
  NaturalnessSelector,
} from "@/components/writing/NaturalnessSelector";
import type { GenerationResultMeta } from "@/hooks/useWritingFlow";

export type { AIAction };

interface ChatModeProps {
  editor: Editor | null;
  selectedText: string;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
  session: AIChatSession;
  // A click on one of the ribbon AI tiles, with a nonce so repeat clicks re-fire.
  trigger?: { action: AIAction; nonce: number } | null;
  layout?: "sidebar" | "full";
}

const GREETING =
  "Hi — I'm Wright, your writing partner. Tell me what you're working on, attach a .docx or text file for extra context, or pick a quick action below to get started. When you highlight text first, those actions bring it into our conversation.";

export function ChatMode({
  editor,
  selectedText,
  onToast,
  session,
  trigger,
  layout = "sidebar",
}: ChatModeProps) {
  const isFull = layout === "full";
  const {
    messages,
    input,
    setInput,
    activeAction,
    setActiveAction,
    attachment,
    fileAttachments,
    parsingFiles,
    fileAccept,
    removeFile,
    addFiles,
    isStreaming,
    applyAction,
    getSelectionContext,
    dismissSelectionContext,
    send,
    clearChat,
    flow,
    writingMode,
    setWritingMode,
    naturalness,
    setNaturalness,
    askQuestions,
    setAskQuestions,
  } = session;
  // While the clarification flow is active, the panel owns the interaction.
  const flowActive = flow.panel.kind !== "idle";
  const flowGenerating = flow.panel.kind === "generating";
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep the latest message in view as it streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const seedAction = (action: AIAction) => {
    const applied = applyAction(action, selectedText);
    if (!applied) return;

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
    if (trigger) seedAction(trigger.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger?.nonce]);

  const insertIntoDoc = (message: string) => {
    const text = getDocumentInsertText(message);
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

  const activeDef = activeAction
    ? CHAT_ACTIONS.find((a) => a.id === activeAction)
    : null;
  const inputPlaceholder = activeDef?.placeholder ?? DEFAULT_CHAT_PLACEHOLDER;
  const inputHint = activeDef?.description ?? null;
  const openFilePicker = () => fileInputRef.current?.click();
  const selectionContext = getSelectionContext(selectedText);

  return (
    <div className="flex h-full flex-col">
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
                (isStreaming || flowGenerating) &&
                i === messages.length - 1 &&
                !isUser;
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
                      !isUser && streamingThis && !m.content
                        ? "min-w-[7.5rem]"
                        : "",
                    ].join(" ")}
                  >
                    {isUser ? (
                      <UserMessageBubble
                        preview={m.userPreview ?? m.content}
                        files={m.attachedFiles}
                      />
                    ) : streamingThis && !m.content ? (
                      <ChatTypingIndicator />
                    ) : (
                      <>
                        <Markdown text={m.content} />
                        {streamingThis && <ChatStreamCursor />}
                      </>
                    )}
                    {!isUser && m.content && !streamingThis && (
                      <AssistantMessageActions
                        content={m.content}
                        writing={m.writing}
                        onInsert={() => insertIntoDoc(m.content)}
                        onRegenerate={
                          m.writing
                            ? () => void flow.regenerate(m.writing!.requestId)
                            : undefined
                        }
                        onToast={onToast}
                      />
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
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={clearChat}
              className="text-[11px] text-neutral-400 hover:text-neutral-600"
            >
              New conversation
            </button>
          </div>
        )}

        {/* Quick actions — sit above the input so they're close to where you type */}
        <div className="mb-2.5">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            Quick actions
          </div>
          <div
            className={
              isFull
                ? "flex flex-wrap gap-1.5"
                : "grid grid-cols-2 gap-1.5"
            }
          >
            {CHAT_ACTIONS.map((a) => {
              const isActive = activeAction === a.id;
              return (
                <div key={a.id} className="group/action relative">
                  <button
                    type="button"
                    onClick={() => seedAction(a.id)}
                    disabled={isStreaming || flowActive}
                    aria-label={`${a.label}: ${a.description}`}
                    aria-pressed={isActive}
                    className={[
                      "w-full rounded-lg border text-left transition-colors disabled:opacity-50",
                      isFull ? "px-3 py-2 text-sm" : "px-2.5 py-1.5 text-xs",
                      isActive
                        ? "border-blue-500 bg-blue-50 text-blue-800"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700",
                    ].join(" ")}
                  >
                    {a.label}
                  </button>
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[min(220px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] leading-snug text-neutral-600 opacity-0 shadow-md transition-opacity group-hover/action:opacity-100 group-focus-within/action:opacity-100"
                  >
                    <span className="block font-medium text-neutral-800">
                      {a.label}
                    </span>
                    {a.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectionContext && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-[3px] border-blue-600 bg-blue-50 px-2.5 py-1.5 text-xs text-neutral-600">
            <span className="mt-[1px] text-blue-600">✦</span>
            <span className="line-clamp-2 flex-1">“{selectionContext}”</span>
            <button
              type="button"
              onClick={() => dismissSelectionContext(selectedText)}
              className="shrink-0 text-neutral-400 hover:text-neutral-700"
              aria-label="Remove attached text"
            >
              ✕
            </button>
          </div>
        )}

        {fileAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {fileAttachments.map((file) => (
              <div
                key={file.id}
                className="flex max-w-full items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 py-1 pl-2 pr-1 text-xs text-neutral-700"
              >
                <FileIcon />
                <span className="truncate">{file.name}</span>
                {file.truncated && (
                  <span className="shrink-0 text-[10px] text-neutral-400">
                    trimmed
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {inputHint && (
          <p id="chat-input-hint" className="mb-1.5 text-[11px] leading-snug text-neutral-500">
            {inputHint}
          </p>
        )}

        {/* Clarification workflow — always directly above the text input,
            never rendered as a chat bubble or document text. */}
        <ClarificationPanel flow={flow} />

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={fileAccept}
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files;
              if (picked?.length) void addFiles(picked);
            }}
          />
          {/* Input box — the writing mode selector lives inside it, bottom left */}
          <div
            className={[
              "flex min-w-0 flex-1 flex-col rounded-lg border bg-white",
              flowActive
                ? "border-neutral-200 bg-neutral-50"
                : "border-neutral-300 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-300",
            ].join(" ")}
          >
            <textarea
              ref={textareaRef}
              value={input}
              disabled={flowActive}
              onChange={(e) => {
                setInput(e.target.value);
                if (activeAction) setActiveAction(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(selectedText);
                }
              }}
              rows={isFull ? 3 : 2}
              placeholder={
                flowActive
                  ? "Answer the question above to continue…"
                  : inputPlaceholder
              }
              aria-describedby={inputHint ? "chat-input-hint" : undefined}
              className="w-full resize-none rounded-t-lg bg-transparent px-3 pb-1 pt-2 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5 px-1.5 pb-1.5">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isStreaming || parsingFiles}
                title="Attach .docx, .txt, or .md for context"
                aria-label="Attach file for context"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40"
              >
                {parsingFiles ? <SpinnerIcon /> : <PaperclipIcon />}
              </button>
              <WritingModeSelector
                mode={writingMode}
                onChange={setWritingMode}
                disabled={isStreaming || flowGenerating}
              />
              <NaturalnessSelector
                level={naturalness}
                onChange={setNaturalness}
                disabled={isStreaming || flowGenerating}
              />
              <AskQuestionsToggle
                enabled={askQuestions}
                onChange={setAskQuestions}
                disabled={isStreaming || flowGenerating}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void send(selectedText)}
            disabled={
              isStreaming ||
              parsingFiles ||
              flowActive ||
              (!input.trim() && !selectionContext && fileAttachments.length === 0)
            }
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

function AssistantMessageActions({
  content,
  writing,
  onInsert,
  onRegenerate,
  onToast,
}: {
  content: string;
  writing?: GenerationResultMeta;
  onInsert: () => void;
  onRegenerate?: () => void;
  onToast: (msg: string, kind?: "success" | "error" | "info") => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {writing && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(content).then(
                () => onToast("Copied.", "success"),
                () => onToast("Couldn't copy.", "error")
              );
            }}
            className="text-[11px] text-blue-600 hover:text-blue-800"
          >
            Copy
          </button>
        )}
        <button
          type="button"
          onClick={onInsert}
          className="text-[11px] text-blue-600 hover:text-blue-800"
        >
          Insert into document
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="text-[11px] text-blue-600 hover:text-blue-800"
          >
            Regenerate
          </button>
        )}
        {writing && (
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
            className="text-[11px] text-neutral-400 hover:text-neutral-600"
          >
            {showDetails ? "Hide details" : "Context used"}
          </button>
        )}
      </div>
      {writing && showDetails && (
        <div className="mt-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-[11px] leading-snug text-neutral-600">
          <div>
            Written in{" "}
            <span className="font-medium">
              {writing.mode.replace(/_/g, " ")}
            </span>{" "}
            mode using {writing.contextCount} stored context item
            {writing.contextCount === 1 ? "" : "s"} and {writing.answerCount}{" "}
            of your answers.
          </div>
          {writing.assumptions.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {writing.assumptions.map((a) => (
                <li key={a.id}>
                  {a.importance === "major" ? "Major assumption: " : "Assumed: "}
                  {a.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserMessageBubble({
  preview,
  files,
}: {
  preview: string;
  files?: Pick<ChatFileAttachment, "name" | "truncated">[];
}) {
  return (
    <div className="space-y-1.5">
      {preview && <div className="whitespace-pre-wrap">{preview}</div>}
      {files && files.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {files.map((file) => (
            <span
              key={file.name}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[11px] text-blue-50"
            >
              <FileIcon className="h-3 w-3" />
              {file.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function FileIcon({ className = "h-3.5 w-3.5 shrink-0" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getDocumentInsertText(message: string) {
  const highlightedSegments = extractMarkdownBlockquotes(message);
  if (highlightedSegments.length > 0) {
    return highlightedSegments.join("\n\n");
  }

  return message.trim();
}

function extractMarkdownBlockquotes(markdown: string) {
  const segments: string[] = [];
  let current: string[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const quoteMatch = line.match(/^ {0,3}>\s?(.*)$/);
    if (quoteMatch) {
      current.push(quoteMatch[1]);
      continue;
    }

    if (current.length > 0) {
      const segment = current.join("\n").trim();
      if (segment) segments.push(segment);
      current = [];
    }
  }

  if (current.length > 0) {
    const segment = current.join("\n").trim();
    if (segment) segments.push(segment);
  }

  return segments;
}
