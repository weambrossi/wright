"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWrightEditor, STORAGE_KEYS } from "@/hooks/useEditor";
import { useDocumentImport } from "@/hooks/useDocumentImport";
import { RibbonToolbar } from "@/components/editor/ribbon/RibbonToolbar";
import { PageCanvas } from "@/components/editor/PageCanvas";
import { FindReplace } from "@/components/editor/FindReplace";
import { AISidebar, type AIAction } from "@/components/ai/AISidebar";
import { ToastHost, useToasts } from "@/components/ui/Toast";

const PENDING_HTML_KEY = "wright:pending-html";
const PENDING_FILENAME_KEY = "wright:pending-filename";

export default function EditorPage() {
  const router = useRouter();
  const [initialContent, setInitialContent] = useState<string | undefined>(
    undefined
  );
  const [initialTitle, setInitialTitle] = useState<string | undefined>(undefined);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [find, setFind] = useState<{ open: boolean; mode: "find" | "replace" }>(
    { open: false, mode: "find" }
  );
  const [aiTrigger, setAiTrigger] = useState<{
    action: AIAction;
    nonce: number;
  } | null>(null);
  const [aiOpenMobile, setAiOpenMobile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, push, dismiss } = useToasts();
  const { importFile } = useDocumentImport();

  // Bootstrap from sessionStorage (uploaded on landing).
  useEffect(() => {
    if (bootstrapped) return;
    const pendingHtml = sessionStorage.getItem(PENDING_HTML_KEY);
    const pendingName = sessionStorage.getItem(PENDING_FILENAME_KEY);
    if (pendingHtml) {
      sessionStorage.removeItem(PENDING_HTML_KEY);
      sessionStorage.removeItem(PENDING_FILENAME_KEY);
      setInitialContent(pendingHtml);
      if (pendingName) setInitialTitle(pendingName);
      setBootstrapped(true);
      push({
        text: `Document loaded — ${stripWords(pendingHtml).toLocaleString()} words`,
        kind: "success",
      });
      return;
    }
    setBootstrapped(true);
  }, [bootstrapped, push]);

  const {
    editor,
    selectedText,
    wordCount,
    title,
    setTitle,
    pageSettings,
    setPageSettings,
  } = useWrightEditor({ initialContent, initialTitle });

  // Offer resume from autosave if no pending upload.
  useEffect(() => {
    if (!editor || !bootstrapped) return;
    if (initialContent) return;
    const saved = localStorage.getItem(STORAGE_KEYS.CONTENT);
    if (!saved || !saved.trim()) return;
    if (!editor.isEmpty) return;
    push({
      text: "Resume your last session?",
      kind: "info",
      action: {
        label: "Resume",
        onClick: () => editor.commands.setContent(saved, false),
      },
    });
  }, [editor, bootstrapped, initialContent, push]);

  // Keyboard shortcuts: Cmd+S export, Cmd+F find, Cmd+H replace.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        handleExport();
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

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const html = await importFile(file);
    e.target.value = "";
    if (!html) {
      push({ text: "Couldn't read that document.", kind: "error" });
      return;
    }
    editor.commands.setContent(html, false);
    setTitle(file.name.replace(/\.docx$/i, ""));
    push({
      text: `Document loaded — ${stripWords(html).toLocaleString()} words`,
      kind: "success",
    });
  };

  const openAI = (action?: AIAction) => {
    setAiTrigger(action ? { action, nonce: Date.now() } : null);
    setAiOpenMobile(true);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-200">
      {/* Title bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-300 bg-white px-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          title="Back to start"
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
        <span className="hidden text-xs text-neutral-500 sm:inline">
          {wordCount.toLocaleString()} words
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Import
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          Export
        </button>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleImportChange}
      />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <RibbonToolbar
            editor={editor}
            pageSettings={pageSettings}
            setPageSettings={setPageSettings}
            onOpenFind={() => setFind({ open: true, mode: "find" })}
            onOpenReplace={() => setFind({ open: true, mode: "replace" })}
            onOpenAI={openAI}
            onToast={(t, k) => push({ text: t, kind: k })}
          />
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
        </main>

        {/* Desktop AI sidebar */}
        <aside className="hidden h-full w-[340px] shrink-0 lg:flex">
          <div className="w-full">
            <AISidebar
              editor={editor}
              selectedText={selectedText}
              trigger={aiTrigger}
              onToast={(t, k) => push({ text: t, kind: k })}
            />
          </div>
        </aside>
      </div>

      {/* Mobile AI drawer */}
      {aiOpenMobile && (
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
                trigger={aiTrigger}
                onToast={(t, k) => push({ text: t, kind: k })}
              />
            </div>
          </div>
        </div>
      )}

      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

function stripWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(" ").length;
}

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9-_ ]/gi, "").trim() || "document";
}
