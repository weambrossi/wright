"use client";

import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { useParams, useRouter } from "next/navigation";
import { useWrightEditor } from "@/hooks/useEditor";
import type { SaveStatus } from "@/hooks/useEditor";
import { useAIChatSession } from "@/hooks/useAIChatSession";
import { DocumentImportButton } from "@/components/document/DocumentImportButton";
import { RibbonToolbar, type TabId } from "@/components/editor/ribbon/RibbonToolbar";
import { PageCanvas } from "@/components/editor/PageCanvas";
import { FindReplace } from "@/components/editor/FindReplace";
import { AISidebar } from "@/components/ai/AISidebar";
import { AIChatView } from "@/components/ai/AIChatView";
import { ToastHost, useToasts } from "@/components/ui/Toast";
import { wrightDocumentToEditorState } from "@/lib/document/wrightToEditor";

export default function EditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const documentId = params.id;

  const [initialContent, setInitialContent] = useState<
    string | JSONContent | undefined
  >(undefined);
  const [initialTitle, setInitialTitle] = useState<string | undefined>(undefined);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [find, setFind] = useState<{ open: boolean; mode: "find" | "replace" }>(
    { open: false, mode: "find" }
  );
  const [aiOpenDesktop, setAiOpenDesktop] = useState(true);
  const [aiOpenMobile, setAiOpenMobile] = useState(false);
  const [activeRibbonTab, setActiveRibbonTab] = useState<TabId>("home");

  const isAIView = activeRibbonTab === "ai";

  const { toasts, push, dismiss } = useToasts();

  // Load this document from the database.
  useEffect(() => {
    if (bootstrapped || !documentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (res.status === 404) {
          push({ text: "That document no longer exists.", kind: "error" });
          router.replace("/");
          return;
        }
        if (!res.ok) throw new Error("Failed to load document");
        const data = (await res.json()) as {
          html?: string;
          contentJson?: JSONContent;
          title?: string;
        };
        if (cancelled) return;
        setInitialContent(data.contentJson ?? data.html ?? "");
        if (data.title) setInitialTitle(data.title);
      } catch {
        if (!cancelled) push({ text: "Couldn't load that document.", kind: "error" });
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, documentId, push, router]);

  const {
    editor,
    selectedText,
    wordCount,
    title,
    setTitle,
    pageSettings,
    setPageSettings,
    saveStatus,
    saveNow,
  } = useWrightEditor({ initialContent, initialTitle, documentId });
  const aiChatSession = useAIChatSession({
    editor,
    onToast: (text, kind) => push({ text, kind }),
  });

  // Keyboard shortcuts: Cmd+S → save, Cmd+F find, Cmd+H replace.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void saveNow();
      } else if (key === "f") {
        e.preventDefault();
        setFind({ open: true, mode: "find" });
      } else if (key === "h") {
        e.preventDefault();
        setFind({ open: true, mode: "replace" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, title]);

  const handleExport = async () => {
    if (!editor) return;
    try {
      const html = editor.getHTML();
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, title }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFilename(title)}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      push({ text: `Exported to ${safeFilename(title)}.docx`, kind: "success" });
    } catch {
      push({ text: "Export failed — please try again.", kind: "error" });
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveRibbonTab(tab);
    if (tab === "ai") {
      setAiOpenMobile(false);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-200">
      {/* Title bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-300 bg-white px-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          title="All documents"
          className="grid h-8 w-8 place-items-center rounded text-neutral-600 hover:bg-neutral-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
        </button>
        <span className="font-serif text-lg italic text-neutral-700">Wright</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          spellCheck={false}
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm font-medium text-neutral-800 hover:border-neutral-300 focus:border-blue-400 focus:outline-none"
          placeholder="Untitled Document"
        />

        {/* Save status indicator */}
        <SaveStatusBadge status={saveStatus} onRetry={() => void saveNow()} />

        <SaveReminder saveStatus={saveStatus} />

        {/* Manual Save button */}
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={saveStatus === "saving"}
          title="Save (⌘S)"
          className={[
            "rounded px-2.5 py-1 text-xs font-medium transition",
            saveStatus === "dirty" || saveStatus === "error"
              ? "bg-amber-accent text-white hover:bg-amber-accent/90"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100",
            saveStatus === "saving" ? "opacity-60" : "",
          ].join(" ")}
        >
          {saveStatus === "saving" ? "Saving…" : "Save"}
        </button>

        <span className="hidden text-xs text-neutral-500 sm:inline">
          {wordCount.toLocaleString()} words
        </span>
        <DocumentImportButton
          label="Import"
          busyLabel="Importing..."
          documentId={documentId}
          className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
          beforeImport={async () => {
            if (!editor) return false;
            const hasContent = editor.getText().trim().length > 0;
            if (hasContent) {
              const confirmed = window.confirm(
                "Wright will save this document, then replace its contents with the imported file. Continue?"
              );
              if (!confirmed) return false;
            }
            await saveNow();
            return true;
          }}
          onImported={(result) => {
            if (!editor) return;
            editor.commands.setContent(
              wrightDocumentToEditorState(result.document),
              false
            );
            setTitle(result.document.title);
            push({
              text:
                result.warnings.length > 0
                  ? "Document imported with formatting warnings."
                  : "Document imported.",
              kind: result.warnings.length > 0 ? "info" : "success",
            });
            result.warnings.slice(0, 3).forEach((warning) => {
              push({ text: warning.message, kind: "info", durationMs: 7000 });
            });
          }}
          onError={(message) => push({ text: message, kind: "error" })}
        />
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          Export
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <RibbonToolbar
            editor={editor}
            pageSettings={pageSettings}
            setPageSettings={setPageSettings}
            activeTab={activeRibbonTab}
            onTabChange={handleTabChange}
            onOpenFind={() => setFind({ open: true, mode: "find" })}
            onOpenReplace={() => setFind({ open: true, mode: "replace" })}
            onToast={(t, k) => push({ text: t, kind: k })}
          />
          <div
            className={
              isAIView ? "hidden" : "flex min-h-0 flex-1 flex-col"
            }
          >
            <PageCanvas
              editor={editor}
              pageSettings={pageSettings}
              setPageSettings={setPageSettings}
              overlay={
                find.open && editor ? (
                  <FindReplace
                    editor={editor}
                    mode={find.mode}
                    onClose={() => setFind((f) => ({ ...f, open: false }))}
                  />
                ) : null
              }
            />
          </div>
          <div
            className={
              isAIView ? "flex min-h-0 flex-1 flex-col" : "hidden"
            }
          >
            <AIChatView
              editor={editor}
              selectedText={selectedText}
              onToast={(t, k) => push({ text: t, kind: k })}
              session={aiChatSession}
            />
          </div>
        </main>

        {/* Desktop AI sidebar — hidden when full AI tab is active */}
        {!isAIView && (
        <aside
          className={[
            "relative hidden h-full shrink-0 overflow-hidden bg-white transition-[width] duration-200 lg:block",
            aiOpenDesktop ? "w-[340px]" : "w-12 border-l border-neutral-300",
          ].join(" ")}
        >
          <div
            className={
              aiOpenDesktop ? "h-full w-[340px]" : "hidden h-full w-[340px]"
            }
          >
            <AISidebar
              editor={editor}
              selectedText={selectedText}
              onClose={() => setAiOpenDesktop(false)}
              onToast={(t, k) => push({ text: t, kind: k })}
              session={aiChatSession}
            />
          </div>
          {!aiOpenDesktop && (
            <button
              type="button"
              onClick={() => setAiOpenDesktop(true)}
              title="Open AI assistant"
              aria-label="Open AI assistant"
              aria-expanded={aiOpenDesktop}
              className="flex h-full w-12 flex-col items-center gap-3 bg-white px-2 py-4 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] [writing-mode:vertical-rl]">
                AI Assistant
              </span>
            </button>
          )}
        </aside>
        )}
      </div>

      {/* Mobile AI drawer — hidden when full AI tab is active */}
      {!isAIView && aiOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setAiOpenMobile(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 h-[85vh] max-h-[85vh] animate-slideUp rounded-t-modal bg-white shadow-toast"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-neutral-300" />
            </div>
            <div className="h-[calc(100%-1.5rem)]">
              <AISidebar
                editor={editor}
                selectedText={selectedText}
                onClose={() => setAiOpenMobile(false)}
                closeDirection="down"
                onToast={(t, k) => push({ text: t, kind: k })}
                session={aiChatSession}
              />
            </div>
          </div>
        </div>
      )}

      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function SaveReminder({ saveStatus }: { saveStatus: SaveStatus }) {
  const [visible, setVisible] = useState(false);
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const status = saveStatusRef.current;
      if (status === "dirty" || status === "error") {
        setVisible(true);
      }
    }, 3 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (
      saveStatus === "saved" ||
      saveStatus === "idle" ||
      saveStatus === "saving"
    ) {
      setVisible(false);
    }
  }, [saveStatus]);

  useEffect(() => {
    if (!visible) return;
    const timeoutId = window.setTimeout(() => setVisible(false), 12 * 1000);
    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  if (!visible) return null;

  return (
    <span className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-accent">
      Don&apos;t forget to save
    </span>
  );
}

function SaveStatusBadge({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry: () => void;
}) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-neutral-400">
        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Saved
      </span>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-xs text-red-500 hover:underline"
      >
        Save failed — retry
      </button>
    );
  }

  // dirty
  return (
    <span className="text-xs text-amber-accent">Unsaved changes</span>
  );
}

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9-_ ]/gi, "").trim() || "document";
}
